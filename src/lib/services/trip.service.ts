import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip, TripItem, PlacePreference } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { CreateTripInput } from '@/lib/validators/trip';
import type { VerifiedPlace } from './ai/types';
import { generateItinerary } from './ai.service';
import { getVerifiedPlacesForDestination } from './ai/popularPlaces';
import { postValidateItems } from './ai/postValidate';
import { validateGeoBoundary, validateTransitFeasibility, optimizeRouteOrder, augmentMissingMeals } from './ai/itineraryValidation';
import { rowToTrip, rowToTripItem } from '@/lib/supabase/helpers';
import { AppError } from '@/lib/errors/appError';

export async function createTrip(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTripInput,
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return rowToTrip(data);
}

export async function getTrips(supabase: SupabaseClient, userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToTrip);
}

export async function getTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select()
    .eq('id', tripId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToTrip(data);
}

export async function updateTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  updates: Partial<Pick<Trip, 'destination' | 'startDate' | 'endDate' | 'status' | 'tripSummary' | 'advisories'>>,
): Promise<Trip> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.destination !== undefined) row.destination = updates.destination;
  if (updates.startDate !== undefined) row.start_date = updates.startDate;
  if (updates.endDate !== undefined) row.end_date = updates.endDate;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.tripSummary !== undefined) row.trip_summary = updates.tripSummary;
  if (updates.advisories !== undefined) row.advisories = updates.advisories;

  const { data, error } = await supabase
    .from('trips')
    .update(row)
    .eq('id', tripId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return rowToTrip(data);
}

export async function deleteTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Trip Items

export async function getTripItems(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripItem[]> {
  // RLS가 trip 소유권을 검증하므로 tripId만으로 조회
  const { data, error } = await supabase
    .from('trip_items')
    .select()
    .eq('trip_id', tripId)
    .order('day_number')
    .order('order_index');

  if (error) throw error;
  return (data || []).map(rowToTripItem);
}

export async function createTripItem(
  supabase: SupabaseClient,
  item: Omit<TripItem, 'id' | 'createdAt'>,
): Promise<TripItem> {
  const { data, error } = await supabase
    .from('trip_items')
    .insert({
      trip_id: item.tripId,
      day_number: item.dayNumber,
      order_index: item.orderIndex,
      place_id: item.placeId,
      place_name_snapshot: item.placeNameSnapshot,
      category: item.category,
      start_time: item.startTime,
      end_time: item.endTime,
      estimated_cost: item.estimatedCost,
      currency: item.currency || 'KRW',
      price_confidence: item.priceConfidence || 'estimated',
      notes: item.notes,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      reason_tags: item.reasonTags || [],
      address: item.address ?? null,
      business_hours: item.businessHours ?? null,
      closed_days: item.closedDays ?? null,
      transit_mode: item.transitMode ?? null,
      transit_duration_min: item.transitDurationMin ?? null,
      transit_summary: item.transitSummary ?? null,
      verified: item.verified ?? true,
      google_place_id: item.googlePlaceId ?? null,
      sub_activities: item.subActivities ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToTripItem(data);
}

export async function updateTripItem(
  supabase: SupabaseClient,
  itemId: string,
  updates: Partial<Pick<TripItem, 'placeNameSnapshot' | 'category' | 'startTime' | 'endTime' | 'estimatedCost' | 'currency' | 'priceConfidence' | 'notes' | 'orderIndex' | 'dayNumber' | 'address' | 'businessHours' | 'closedDays' | 'transitMode' | 'transitDurationMin' | 'transitSummary'>>,
  tripId: string,
): Promise<TripItem> {
  const row: Record<string, unknown> = {};
  if (updates.placeNameSnapshot !== undefined) row.place_name_snapshot = updates.placeNameSnapshot;
  if (updates.category !== undefined) row.category = updates.category;
  if (updates.startTime !== undefined) row.start_time = updates.startTime;
  if (updates.endTime !== undefined) row.end_time = updates.endTime;
  if (updates.estimatedCost !== undefined) row.estimated_cost = updates.estimatedCost;
  if (updates.currency !== undefined) row.currency = updates.currency;
  if (updates.priceConfidence !== undefined) row.price_confidence = updates.priceConfidence;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.orderIndex !== undefined) row.order_index = updates.orderIndex;
  if (updates.dayNumber !== undefined) row.day_number = updates.dayNumber;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.businessHours !== undefined) row.business_hours = updates.businessHours;
  if (updates.closedDays !== undefined) row.closed_days = updates.closedDays;
  if (updates.transitMode !== undefined) row.transit_mode = updates.transitMode;
  if (updates.transitDurationMin !== undefined) row.transit_duration_min = updates.transitDurationMin;
  if (updates.transitSummary !== undefined) row.transit_summary = updates.transitSummary;

  const query = supabase
    .from('trip_items')
    .update(row)
    .eq('id', itemId)
    .eq('trip_id', tripId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  return rowToTripItem(data);
}

export async function deleteTripItem(supabase: SupabaseClient, itemId: string, tripId: string): Promise<void> {
  const query = supabase.from('trip_items').delete().eq('id', itemId).eq('trip_id', tripId);
  const { error } = await query;
  if (error) throw error;
}

export async function bulkInsertTripItems(
  supabase: SupabaseClient,
  items: Omit<TripItem, 'id' | 'createdAt'>[],
): Promise<TripItem[]> {
  const rows = items.map((item) => ({
    trip_id: item.tripId,
    day_number: item.dayNumber,
    order_index: item.orderIndex,
    place_id: item.placeId,
    place_name_snapshot: item.placeNameSnapshot,
    category: item.category,
    start_time: item.startTime,
    end_time: item.endTime,
    estimated_cost: item.estimatedCost,
    currency: item.currency || 'KRW',
    price_confidence: item.priceConfidence || 'estimated',
    notes: item.notes,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    reason_tags: item.reasonTags || [],
    address: item.address ?? null,
    business_hours: item.businessHours ?? null,
    closed_days: item.closedDays ?? null,
    transit_mode: item.transitMode ?? null,
    transit_duration_min: item.transitDurationMin ?? null,
    transit_summary: item.transitSummary ?? null,
    verified: item.verified ?? true,
    google_place_id: item.googlePlaceId ?? null,
    sub_activities: item.subActivities ?? null,
  }));

  const { data, error } = await supabase
    .from('trip_items')
    .insert(rows)
    .select();

  if (error) throw error;
  return (data || []).map(rowToTripItem);
}

// Share token

export async function setShareToken(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({ share_token: token })
    .eq('id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeShareToken(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({ share_token: null })
    .eq('id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getTripByShareToken(
  supabase: SupabaseClient,
  shareToken: string,
): Promise<{ trip: Trip; items: TripItem[] } | null> {
  // SECURITY DEFINER 함수로 RLS 우회 — user_id가 반환되지 않음
  const { data: tripRows, error: tripError } = await supabase
    .rpc('get_trip_by_share_token', { p_token: shareToken });

  if (tripError) throw tripError;
  if (!tripRows || tripRows.length === 0) return null;

  const trip = rowToTrip({ ...tripRows[0], user_id: '' });

  const { data: itemRows, error: itemsError } = await supabase
    .rpc('get_trip_items_by_share_token', { p_token: shareToken });

  if (itemsError) throw itemsError;

  return { trip, items: (itemRows || []).map(rowToTripItem) };
}

export async function deleteTripItemsByTripId(
  supabase: SupabaseClient,
  tripId: string,
): Promise<void> {
  const { error } = await supabase.from('trip_items').delete().eq('trip_id', tripId);
  if (error) throw error;
}

export async function generateTripItems(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  profile: FullProfileInput,
  input: CreateTripInput,
  placePreferences?: { placeName: string; preference: PlacePreference }[],
): Promise<TripItem[]> {
  // 소유권 확인
  const trip = await getTrip(supabase, tripId, userId);
  if (!trip) throw new AppError('NOT_FOUND', '여행을 찾을 수 없습니다', 404);

  // 1. Google Places에서 검증된 장소 캐시 로드
  let verifiedPlaces: VerifiedPlace[] = [];
  const cachedPlaceIds = new Set<string>();

  try {
    const cached = await getVerifiedPlacesForDestination(supabase, input.destination);
    verifiedPlaces = cached.map((c) => ({
      googlePlaceId: c.googlePlaceId,
      displayName: c.displayName,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      rating: c.rating,
      businessHours: c.businessHours,
      closedDays: c.closedDays,
      category: c.category,
    }));
    for (const vp of verifiedPlaces) {
      cachedPlaceIds.add(vp.googlePlaceId);
    }
  } catch (err) {
    console.warn('[TripService] Google Places 캐시 로드 실패, AI만으로 진행:', err instanceof Error ? err.message : err);
  }

  // 2. AI 일정 생성 (검증된 장소 주입)
  const aiResult = await generateItinerary(profile, {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
  }, placePreferences, verifiedPlaces.length > 0 ? verifiedPlaces : undefined);

  const { items, tripSummary, advisories } = aiResult;

  // 3. 사후 검증 (캐시 유무와 무관하게 항상 실행)
  let validatedItems = items;
  try {
    validatedItems = await postValidateItems(items, input.destination, cachedPlaceIds);
  } catch (err) {
    console.warn('[TripService] 사후 검증 실패, 원본 사용:', err instanceof Error ? err.message : err);
  }

  // 4. 지리 경계 검증 (Google 좌표 기반)
  validatedItems = validateGeoBoundary(validatedItems);

  // 5. 동선 최적화 (지리적 근접성 기반)
  validatedItems = optimizeRouteOrder(validatedItems);

  // 6. 이동 타당성 검증
  validatedItems = validateTransitFeasibility(validatedItems);

  // 7. 식사 커버리지 검증 + 보강 (누락 시 디폴트 삽입)
  validatedItems = augmentMissingMeals(validatedItems);

  const itemsWithTripId = validatedItems.map((item) => ({ ...item, tripId }));

  // 기존 아이템 삭제 후 새로 삽입
  await deleteTripItemsByTripId(supabase, tripId);
  const inserted = await bulkInsertTripItems(supabase, itemsWithTripId);

  // Trip 상태를 generated로 업데이트 + 메타데이터 저장
  await updateTrip(supabase, tripId, userId, {
    status: 'generated',
    tripSummary: tripSummary || null,
    advisories: advisories || null,
  });

  return inserted;
}

export async function getVisitedPlaces(
  supabase: SupabaseClient,
  userId: string,
  destination: string,
): Promise<string[]> {
  // 사용자가 이 목적지로 만든 이전 여행의 장소 이름 목록
  const { data: trips } = await supabase
    .from('trips')
    .select('id')
    .eq('user_id', userId)
    .ilike('destination', `%${destination.replace(/[%_\\]/g, '\\$&')}%`);

  if (!trips || trips.length === 0) return [];

  const tripIds = trips.map((t: { id: string }) => t.id);
  const { data: items } = await supabase
    .from('trip_items')
    .select('place_name_snapshot')
    .in('trip_id', tripIds);

  if (!items) return [];

  // 중복 제거
  return [...new Set(items.map((i: { place_name_snapshot: string }) => i.place_name_snapshot))];
}
