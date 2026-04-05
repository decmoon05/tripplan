'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/types/api';
import type { UserProfile } from '@/types/database';

async function fetchProfile(): Promise<UserProfile | null> {
  const res = await fetch('/api/v1/profile');
  const json: ApiResponse<UserProfile | null> = await res.json();
  if (!json.success) throw new Error(json.error?.message || '프로필 조회 실패');
  return json.data;
}

async function saveProfile(data: {
  mbtiStyle: string;
  lifestyle: {
    morningType: string;
    stamina: string;
    adventureLevel: string;
    photoStyle: string;
  };
  foodPreference: string[];
  interests?: string[];
  customFoodPreference?: string;
  customInterests?: string;
}): Promise<UserProfile> {
  const res = await fetch('/api/v1/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json: ApiResponse<UserProfile> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error?.message || '프로필 저장 실패');
  return json.data;
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
