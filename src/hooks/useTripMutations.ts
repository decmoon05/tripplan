'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/trips';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { UpdateTripInput, UpdateTripItemInput } from '@/lib/validators/tripItem';
import type { PlacePreference } from '@/types/database';

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { destination: string; startDate: string; endDate: string }) =>
      api.createTrip(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useGenerateItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tripId,
      profile,
      tripInput,
      placePreferences,
    }: {
      tripId: string;
      profile: FullProfileInput;
      tripInput: { destination: string; startDate: string; endDate: string };
      placePreferences?: { placeName: string; preference: PlacePreference }[];
    }) => api.generateAiItems(tripId, profile, tripInput, placePreferences),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId, 'items'] });
    },
  });
}

export function useAddItem(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: Parameters<typeof api.addTripItem>[1]) =>
      api.addTripItem(tripId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] });
    },
  });
}

export function useUpdateItem(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: Omit<UpdateTripItemInput, 'itemId'> }) =>
      api.updateTripItem(tripId, itemId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] });
    },
  });
}

export function useDeleteItem(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => api.deleteTripItem(tripId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, updates }: { tripId: string; updates: UpdateTripInput }) =>
      api.updateTrip(tripId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips', data.id] });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tripId: string) => api.deleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
