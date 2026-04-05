'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LifestyleAnswers } from '@/components/features/profile/steps/LifestyleStep';

// 온보딩 프로필 — 한 번만 입력 (성격/성향/라이프스타일)
export interface ProfileFormData {
  mbtiStyle: string;
  lifestyle: LifestyleAnswers;
  foodPreference: string[];
  interests: string[];
  customFoodPreference: string;
  customInterests: string;
}

interface ProfileStore {
  formData: ProfileFormData;
  isCompleted: boolean;
  setFormData: (data: Partial<ProfileFormData>) => void;
  setCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialFormData: ProfileFormData = {
  mbtiStyle: '',
  lifestyle: { morningType: '', stamina: '', adventureLevel: '', photoStyle: '' },
  foodPreference: [],
  interests: [],
  customFoodPreference: '',
  customInterests: '',
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      formData: initialFormData,
      isCompleted: false,
      setFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data },
        })),
      setCompleted: (completed) => set({ isCompleted: completed }),
      reset: () => set({ formData: initialFormData, isCompleted: false }),
    }),
    {
      name: 'tripplan-profile',
      version: 4,
      migrate: () => ({ formData: initialFormData, isCompleted: false }),
    },
  ),
);
