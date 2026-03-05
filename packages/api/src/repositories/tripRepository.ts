import { prisma } from '../utils/prisma';

/**
 * AI가 생성한 일정 데이터 구조 (createWithItinerary 입력용)
 */
interface ItineraryDay {
  dayNumber: number;
  date?: Date;
  places: Array<{
    googlePlaceId: string;
    order: number;
    durationMinutes: number;
    notes?: string;
  }>;
}

/**
 * 여행 + 일정 트랜잭션 생성
 * - Trip → TripDay[] → TripPlace[] 를 하나의 트랜잭션으로 생성
 */
export function createWithItinerary(
  userId: string,
  tripData: {
    destination: string;
    startDate?: Date;
    endDate?: Date;
    companions: string;
  },
  days: ItineraryDay[]
) {
  return prisma.$transaction(async (tx) => {
    // 1. Trip 생성
    const trip = await tx.trip.create({
      data: {
        userId,
        destination: tripData.destination,
        startDate: tripData.startDate ?? null,
        endDate: tripData.endDate ?? null,
        companions: tripData.companions,
        status: 'draft',
      },
    });

    // 2. TripDay + TripPlace 생성
    for (const day of days) {
      await tx.tripDay.create({
        data: {
          tripId: trip.id,
          dayNumber: day.dayNumber,
          date: day.date ?? null,
          places: {
            create: day.places.map((p) => ({
              googlePlaceId: p.googlePlaceId,
              order: p.order,
              durationMinutes: p.durationMinutes,
              notes: p.notes ?? null,
            })),
          },
        },
      });
    }

    // 3. 생성된 전체 데이터 반환
    return tx.trip.findUniqueOrThrow({
      where: { id: trip.id },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            places: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
  });
}

/**
 * 내 여행 목록 (최신순, 페이지네이션)
 * - days 카운트 포함
 */
export function findByUserId(userId: string, skip: number, take: number) {
  return prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: {
      _count: { select: { days: true } },
    },
  });
}

/** 사용자의 여행 총 개수 */
export function countByUserId(userId: string) {
  return prisma.trip.count({
    where: { userId },
  });
}

/**
 * 여행 상세 — 전체 일정 + 장소 포함
 */
export function findByIdWithDetails(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      days: {
        orderBy: { dayNumber: 'asc' },
        include: {
          places: { orderBy: { order: 'asc' } },
        },
      },
      issues: true,
    },
  });
}

/**
 * 소유권 확인용 — userId만 select
 * 향후 TripMember 테이블 추가 시 이 함수만 확장하면 됨
 */
export function findById(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true },
  });
}

/**
 * 특정 날짜의 장소 전체 교체 (deleteMany → createMany)
 */
export function replaceDayPlaces(
  tripDayId: string,
  places: Array<{
    googlePlaceId: string;
    order: number;
    durationMinutes: number;
    notes?: string;
  }>
) {
  return prisma.$transaction(async (tx) => {
    // 기존 장소 모두 삭제
    await tx.tripPlace.deleteMany({
      where: { tripDayId },
    });

    // 새 장소 일괄 생성
    await tx.tripPlace.createMany({
      data: places.map((p) => ({
        tripDayId,
        googlePlaceId: p.googlePlaceId,
        order: p.order,
        durationMinutes: p.durationMinutes,
        notes: p.notes ?? null,
      })),
    });

    // 교체된 결과 반환
    return tx.tripDay.findUniqueOrThrow({
      where: { id: tripDayId },
      include: {
        places: { orderBy: { order: 'asc' } },
      },
    });
  });
}

/**
 * 특정 여행의 특정 날짜 찾기
 */
export function findTripDay(tripId: string, dayNumber: number) {
  return prisma.tripDay.findFirst({
    where: { tripId, dayNumber },
  });
}
