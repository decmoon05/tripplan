'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTrip, fetchTripItems } from '@/lib/api/trips';

export function useTripDetail(tripId: string) {
  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => fetchTrip(tripId),
    enabled: !!tripId,
  });

  const itemsQuery = useQuery({
    queryKey: ['trips', tripId, 'items'],
    queryFn: () => fetchTripItems(tripId),
    enabled: !!tripId,
  });

  return {
    trip: tripQuery.data ?? null,
    items: itemsQuery.data ?? [],
    isLoading: tripQuery.isLoading || itemsQuery.isLoading,
    error: tripQuery.error || itemsQuery.error,
    refetchItems: itemsQuery.refetch,
  };
}
