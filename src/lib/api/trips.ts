import type { ApiResponse } from '@/types/api';
import type { Trip, TripItem, PlacePreference } from '@/types/database';
import type { UpdateTripInput, UpdateTripItemInput } from '@/lib/validators/tripItem';
import type { FullProfileInput } from '@/lib/validators/profile';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || '요청에 실패했습니다');
  }
  return json.data as T;
}

// Trips
export function fetchTrips(): Promise<Trip[]> {
  return fetchApi<Trip[]>('/api/v1/trips');
}

export function fetchTrip(tripId: string): Promise<Trip> {
  return fetchApi<Trip>(`/api/v1/trips/${tripId}`);
}

export function createTrip(input: { destination: string; startDate: string; endDate: string }): Promise<Trip> {
  return fetchApi<Trip>('/api/v1/trips', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrip(tripId: string, updates: UpdateTripInput): Promise<Trip> {
  return fetchApi<Trip>(`/api/v1/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteTrip(tripId: string): Promise<null> {
  return fetchApi<null>(`/api/v1/trips/${tripId}`, { method: 'DELETE' });
}

// Trip Items
export function fetchTripItems(tripId: string): Promise<TripItem[]> {
  return fetchApi<TripItem[]>(`/api/v1/trips/${tripId}/items`);
}

export function addTripItem(
  tripId: string,
  item: Omit<TripItem, 'id' | 'tripId' | 'createdAt' | 'latitude' | 'longitude' | 'reasonTags'>,
): Promise<TripItem> {
  return fetchApi<TripItem>(`/api/v1/trips/${tripId}/items`, {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export function updateTripItem(
  tripId: string,
  itemId: string,
  updates: Omit<UpdateTripItemInput, 'itemId'>,
): Promise<TripItem> {
  return fetchApi<TripItem>(`/api/v1/trips/${tripId}/items`, {
    method: 'PATCH',
    body: JSON.stringify({ itemId, ...updates }),
  });
}

export function deleteTripItem(tripId: string, itemId: string): Promise<null> {
  return fetchApi<null>(`/api/v1/trips/${tripId}/items?itemId=${itemId}`, {
    method: 'DELETE',
  });
}

// Share
export function shareTrip(tripId: string): Promise<{ shareToken: string }> {
  return fetchApi<{ shareToken: string }>(`/api/v1/trips/${tripId}/share`, {
    method: 'POST',
  });
}

// AI Feasibility Check
export function checkFeasibility(input: {
  destination: string;
  specialNote: string;
  interests?: string[];
  customInterests?: string;
  companion?: string;
}): Promise<import('@/lib/services/ai/types').FeasibilityCheckResult> {
  return fetchApi('/api/v1/ai/feasibility-check', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// AI Generate (non-streaming)
export function generateAiItems(
  tripId: string,
  profile: FullProfileInput,
  tripInput: { destination: string; startDate: string; endDate: string },
  placePreferences?: { placeName: string; preference: PlacePreference }[],
): Promise<TripItem[]> {
  return fetchApi<TripItem[]>('/api/v1/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ tripId, profile, tripInput, placePreferences }),
  });
}

// AI Generate (streaming via SSE)
export interface StreamEvent {
  type: 'progress' | 'grounding' | 'item' | 'complete' | 'error';
  data: Record<string, unknown>;
}

export async function generateAiItemsStream(
  tripId: string,
  profile: FullProfileInput,
  tripInput: { destination: string; startDate: string; endDate: string },
  placePreferences?: { placeName: string; preference: PlacePreference }[],
  onEvent?: (event: StreamEvent) => void,
): Promise<TripItem[]> {
  const response = await fetch('/api/v1/ai/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, profile, tripInput, placePreferences }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: '스트리밍 요청 실패' } }));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  if (!response.body) throw new Error('스트리밍 응답 본문이 없습니다');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultItems: TripItem[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE 파싱: "event: <type>\ndata: <json>\n\n"
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }

      if (!eventType || !eventData) continue;

      try {
        const parsed = JSON.parse(eventData);
        onEvent?.({ type: eventType as StreamEvent['type'], data: parsed });

        if (eventType === 'complete' && parsed.items) {
          resultItems = parsed.items;
        }

        if (eventType === 'error') {
          throw new Error(parsed.message || '스트리밍 중 오류 발생');
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('스트리밍')) throw e;
        console.warn('[SSE] 이벤트 파싱 실패:', eventData);
      }
    }
  }

  return resultItems;
}
