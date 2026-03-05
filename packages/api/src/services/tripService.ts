import { Trip, TripDay, TripPlace, Place, PlaceCategory } from '@tripwise/shared';
import { AppError } from '../middlewares/errorHandler';
import * as tripRepo from '../repositories/tripRepository';
import * as placeCacheRepo from '../repositories/placeCacheRepository';
import * as profileService from './profileService';
import * as claudeService from './claudeService';
import { CreateTripInput, UpdateTripPlacesInput, PaginationInput } from '../types/validations';

// ===== 접근 권한 검증 =====
// 향후 TripMember 테이블 추가 시 이 함수만 확장하면 됨
// Phase 1: 소유자만 접근 가능
// Phase 2+: 파티 멤버 (owner/editor/viewer) 역할별 접근

type TripPermission = 'read' | 'write';

/**
 * 여행 접근 권한 검증
 * - Phase 1: userId === trip.userId 이면 모든 권한
 * - 향후: TripMember 조회 → 역할별 권한 확인
 *
 * @returns tripId (검증 통과 시)
 * @throws 403 FORBIDDEN / 404 TRIP_NOT_FOUND
 */
async function verifyTripAccess(
  userId: string,
  tripId: string,
  _permission: TripPermission // Phase 1에서는 미사용, 구조만 확보
): Promise<string> {
  const trip = await tripRepo.findById(tripId);

  if (!trip) {
    throw new AppError('TRIP_NOT_FOUND', 404, '여행을 찾을 수 없습니다.');
  }

  // Phase 1: 소유자만 접근 가능
  if (trip.userId !== userId) {
    throw new AppError('FORBIDDEN', 403, '이 여행에 접근할 권한이 없습니다.');
  }

  return trip.id;
}

// ===== 여행 생성 =====

/**
 * 여행 생성 + AI 일정 자동 생성
 * 1. 날짜 계산
 * 2. 사용자 프로필 조회 (nullable)
 * 3. Claude AI로 일정 생성
 * 4. 장소 메타데이터를 PlaceCache에 저장
 * 5. Trip + TripDay + TripPlace 트랜잭션 저장
 */
export async function createTrip(
  userId: string,
  input: CreateTripInput
): Promise<Trip> {
  // 1. 일수 계산
  const numberOfDays = calculateNumberOfDays(
    input.startDate ? new Date(input.startDate) : undefined,
    input.endDate ? new Date(input.endDate) : undefined
  );

  // 2. 사용자 프로필 조회 (없어도 에러 아님)
  let profile = null;
  try {
    profile = await profileService.getProfile(userId);
  } catch (err) {
    // PROFILE_NOT_FOUND만 무시, DB 에러 등은 로그 기록
    if (err instanceof AppError && err.code === 'PROFILE_NOT_FOUND') {
      console.log('[TRIP_SERVICE] 프로필 없이 기본 일정 생성');
    } else {
      console.error('[TRIP_SERVICE] 프로필 조회 중 예기치 않은 에러:', err);
    }
  }

  // 3. AI 일정 생성
  const aiItinerary = await claudeService.generateItinerary(
    input.destination,
    numberOfDays,
    input.companions,
    profile
  );

  // 4. AI 장소 데이터를 PlaceCache에 저장 (실패해도 여행 생성은 계속)
  try {
    await cachePlaceMetadata(aiItinerary, input.destination);
  } catch (cacheErr) {
    console.error('[TRIP_SERVICE] PlaceCache 저장 실패 (여행 생성은 계속):', cacheErr);
  }

  // 5. DB 저장 (트랜잭션)
  const days = aiItinerary.days.map((aiDay) => ({
    dayNumber: aiDay.dayNumber,
    date: calculateDayDate(input.startDate, aiDay.dayNumber),
    places: aiDay.places.map((p, idx) => ({
      googlePlaceId: p.googlePlaceId,
      order: idx,
      durationMinutes: p.durationMinutes,
      notes: p.notes,
    })),
  }));

  const tripData = {
    destination: input.destination,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    companions: input.companions,
  };

  const created = await tripRepo.createWithItinerary(userId, tripData, days);

  // 6. PlaceCache 조인하여 응답 변환 (캐시 실패 시 폴백)
  const allGooglePlaceIds = created.days.flatMap((d) =>
    d.places.map((p) => p.googlePlaceId)
  );
  const cachedPlaces = await placeCacheRepo.findManyByGooglePlaceIds(allGooglePlaceIds);
  const cacheMap = new Map(cachedPlaces.map((c) => [c.googlePlaceId, c.cachedData]));

  return toTripResponseWithPlaceData(
    { ...created, issues: [] },
    cacheMap
  );
}

// ===== 여행 목록 (페이지네이션) =====

interface PaginatedTrips {
  trips: Trip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listTrips(
  userId: string,
  pagination: PaginationInput
): Promise<PaginatedTrips> {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [trips, total] = await Promise.all([
    tripRepo.findByUserId(userId, skip, limit),
    tripRepo.countByUserId(userId),
  ]);

  return {
    trips: trips.map((trip) => ({
      id: trip.id,
      destination: trip.destination,
      startDate: trip.startDate?.toISOString(),
      endDate: trip.endDate?.toISOString(),
      companions: trip.companions as Trip['companions'],
      status: trip.status as Trip['status'],
      days: [], // 목록에서는 days 빈 배열 (상세에서 조회)
      createdAt: trip.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ===== 여행 상세 =====

export async function getTripDetail(
  userId: string,
  tripId: string
): Promise<Trip> {
  await verifyTripAccess(userId, tripId, 'read');

  const trip = await tripRepo.findByIdWithDetails(tripId);
  if (!trip) {
    throw new AppError('TRIP_NOT_FOUND', 404, '여행을 찾을 수 없습니다.');
  }

  // PlaceCache에서 장소 메타데이터 조인
  const allGooglePlaceIds = trip.days.flatMap((d) =>
    d.places.map((p) => p.googlePlaceId)
  );

  const cachedPlaces = await placeCacheRepo.findManyByGooglePlaceIds(allGooglePlaceIds);
  const cacheMap = new Map(cachedPlaces.map((c) => [c.googlePlaceId, c.cachedData]));

  return toTripResponseWithPlaceData(trip, cacheMap);
}

// ===== 일정 수정 (날짜별 장소 교체) =====

export async function updateTripPlaces(
  userId: string,
  tripId: string,
  input: UpdateTripPlacesInput
): Promise<TripDay> {
  await verifyTripAccess(userId, tripId, 'write');

  // 해당 날짜 찾기
  const tripDay = await tripRepo.findTripDay(tripId, input.dayNumber);
  if (!tripDay) {
    throw new AppError(
      'DAY_NOT_FOUND',
      404,
      `Day ${input.dayNumber}을 찾을 수 없습니다.`
    );
  }

  // 장소 교체
  const updatedDay = await tripRepo.replaceDayPlaces(tripDay.id, input.places);

  // PlaceCache에서 메타데이터 조인
  const placeIds = updatedDay.places.map((p) => p.googlePlaceId);
  const cachedPlaces = await placeCacheRepo.findManyByGooglePlaceIds(placeIds);
  const cacheMap = new Map(cachedPlaces.map((c) => [c.googlePlaceId, c.cachedData]));

  return {
    id: updatedDay.id,
    dayNumber: updatedDay.dayNumber,
    date: updatedDay.date?.toISOString(),
    places: updatedDay.places.map((p) => toTripPlaceResponse(p, cacheMap)),
  };
}

// ===== 내부 유틸리티 =====

/**
 * 시작일/종료일로 일수 계산 (기본 3일)
 */
function calculateNumberOfDays(startDate?: Date, endDate?: Date): number {
  if (startDate && endDate) {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // 시작일 포함
    return Math.max(1, Math.min(diffDays, 14)); // 1~14일 제한
  }
  return 3; // 기본값
}

/**
 * 시작일 + dayNumber로 해당 날짜 계산
 */
function calculateDayDate(startDateStr?: string, dayNumber?: number): Date | undefined {
  if (!startDateStr || !dayNumber) return undefined;
  const date = new Date(startDateStr);
  date.setDate(date.getDate() + dayNumber - 1);
  return date;
}

/**
 * AI 장소 메타데이터를 PlaceCache에 저장
 * - 30일 후 만료
 */
async function cachePlaceMetadata(
  itinerary: claudeService.AIItinerary,
  destination: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const allPlaces = itinerary.days.flatMap((d) => d.places);

  // 중복 제거 (같은 googlePlaceId)
  const uniquePlaces = new Map(allPlaces.map((p) => [p.googlePlaceId, p]));

  const upsertPromises = Array.from(uniquePlaces.values()).map((place) =>
    placeCacheRepo.upsert(
      place.googlePlaceId,
      {
        name: place.name,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        notes: place.notes,
        destination,
      } as object,
      expiresAt
    )
  );

  await Promise.all(upsertPromises);
}

/**
 * Prisma Trip → 공유 타입 Trip 변환
 */
function toTripResponse(trip: Awaited<ReturnType<typeof tripRepo.createWithItinerary>>): Trip {
  return {
    id: trip.id,
    destination: trip.destination,
    startDate: trip.startDate?.toISOString(),
    endDate: trip.endDate?.toISOString(),
    companions: trip.companions as Trip['companions'],
    status: trip.status as Trip['status'],
    days: trip.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date?.toISOString(),
      places: day.places.map((p) => ({
        id: p.id,
        order: p.order,
        durationMinutes: p.durationMinutes,
        notes: p.notes ?? undefined,
        place: {
          googlePlaceId: p.googlePlaceId,
          name: p.googlePlaceId, // PlaceCache 미조인 상태 → googlePlaceId를 이름으로 임시 사용
          category: 'attraction' as PlaceCategory,
          lat: 0,
          lng: 0,
        },
      })),
    })),
    createdAt: trip.createdAt.toISOString(),
  };
}

/**
 * Prisma Trip + PlaceCache → 공유 타입 Trip 변환 (상세용)
 */
function toTripResponseWithPlaceData(
  trip: NonNullable<Awaited<ReturnType<typeof tripRepo.findByIdWithDetails>>>,
  cacheMap: Map<string, unknown>
): Trip {
  return {
    id: trip.id,
    destination: trip.destination,
    startDate: trip.startDate?.toISOString(),
    endDate: trip.endDate?.toISOString(),
    companions: trip.companions as Trip['companions'],
    status: trip.status as Trip['status'],
    days: trip.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date?.toISOString(),
      places: day.places.map((p) => toTripPlaceResponse(p, cacheMap)),
    })),
    issues: trip.issues.map((issue) => ({
      id: issue.id,
      placeId: issue.placeId ?? undefined,
      issueType: issue.issueType as 'construction' | 'closure' | 'event' | 'safety',
      description: issue.description,
      severity: issue.severity as 'info' | 'warning' | 'critical',
    })),
    createdAt: trip.createdAt.toISOString(),
  };
}

/**
 * TripPlace + PlaceCache → 공유 타입 TripPlace 변환
 */
function toTripPlaceResponse(
  p: { id: string; googlePlaceId: string; order: number; durationMinutes: number; notes: string | null },
  cacheMap: Map<string, unknown>
): TripPlace {
  const cached = cacheMap.get(p.googlePlaceId) as Record<string, unknown> | undefined;

  const place: Place = {
    googlePlaceId: p.googlePlaceId,
    name: (cached?.name as string) ?? p.googlePlaceId,
    category: (cached?.category as PlaceCategory) ?? 'attraction',
    lat: (cached?.lat as number) ?? 0,
    lng: (cached?.lng as number) ?? 0,
  };

  return {
    id: p.id,
    order: p.order,
    durationMinutes: p.durationMinutes,
    notes: p.notes ?? undefined,
    place,
  };
}
