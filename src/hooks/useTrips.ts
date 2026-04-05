'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTrips } from '@/lib/api/trips';

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: fetchTrips,
  });
}
