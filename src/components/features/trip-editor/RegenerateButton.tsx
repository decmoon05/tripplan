'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useProfileStore } from '@/stores/profileStore';
import { useProfile } from '@/hooks/useProfile';
import { useGenerateItems } from '@/hooks/useTripMutations';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { TravelPace, BudgetRange, CompanionType } from '@/types/database';
import { PaceStep } from '@/components/features/profile/steps/PaceStep';
import { BudgetStep } from '@/components/features/profile/steps/BudgetStep';
import { CompanionStep } from '@/components/features/profile/steps/CompanionStep';
import { SpecialNoteStep } from '@/components/features/profile/steps/SpecialNoteStep';

interface RegenerateButtonProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
}

export function RegenerateButton({
  tripId,
  destination,
  startDate,
  endDate,
}: RegenerateButtonProps) {
  const { formData: profileData } = useProfileStore();
  const { data: savedProfile } = useProfile();
  const generateItems = useGenerateItems();
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefStep, setPrefStep] = useState(0);

  const [travelPace, setTravelPace] = useState<TravelPace | ''>('');
  const [budgetRange, setBudgetRange] = useState<BudgetRange | ''>('');
  const [companion, setCompanion] = useState<CompanionType | ''>('');
  const [specialNote, setSpecialNote] = useState('');

  const profile = savedProfile || profileData;

  const handleStartRegenerate = () => {
    if (!confirm('현재 일정을 모두 삭제하고 새로 생성합니다. 계속하시겠습니까?')) return;
    setShowPrefs(true);
    setPrefStep(0);
  };

  const handleGenerate = () => {
    const sp = savedProfile;
    const lifestyle = sp
      ? { morningType: sp.morningType, stamina: sp.stamina,
          adventureLevel: sp.adventureLevel, photoStyle: sp.photoStyle }
      : profileData.lifestyle || { morningType: 'moderate', stamina: 'moderate', adventureLevel: 'balanced', photoStyle: 'casual' };

    const fullProfile = {
      mbtiStyle: (sp?.mbtiStyle || profileData.mbtiStyle) || 'ENFP',
      lifestyle,
      foodPreference: (sp?.foodPreference || profileData.foodPreference) || [],
      interests: (sp?.interests || profileData.interests) || [],
      travelPace: travelPace || 'moderate',
      budgetRange: budgetRange || 'moderate',
      companion: companion || 'solo',
      specialNote,
    } as FullProfileInput;

    setShowPrefs(false);
    generateItems.mutate({
      tripId,
      profile: fullProfile,
      tripInput: { destination, startDate, endDate },
    });
  };

  const canProceed = () => {
    switch (prefStep) {
      case 0: return travelPace !== '';
      case 1: return budgetRange !== '';
      case 2: return companion !== '';
      case 3: return true;
      default: return false;
    }
  };

  if (showPrefs) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="mb-4 text-sm text-gray-500">재생성 설정 ({prefStep + 1}/4)</div>
        {prefStep === 0 && <PaceStep value={travelPace} onChange={setTravelPace} />}
        {prefStep === 1 && <BudgetStep value={budgetRange} onChange={setBudgetRange} />}
        {prefStep === 2 && <CompanionStep value={companion} onChange={setCompanion} />}
        {prefStep === 3 && <SpecialNoteStep value={specialNote} onChange={setSpecialNote} />}
        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={() => prefStep > 0 ? setPrefStep(prefStep - 1) : setShowPrefs(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {prefStep === 0 ? '취소' : '이전'}
          </button>
          <button
            type="button"
            onClick={() => prefStep < 3 ? setPrefStep(prefStep + 1) : handleGenerate()}
            disabled={!canProceed()}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white font-medium hover:bg-[var(--color-primary-hover)] disabled:bg-gray-300"
          >
            {prefStep === 3 ? '재생성 시작' : '다음'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleStartRegenerate}
        disabled={generateItems.isPending}
      >
        {generateItems.isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
            재생성 중...
          </span>
        ) : (
          '일정 재생성'
        )}
      </Button>
      {generateItems.isError && (
        <p className="mt-2 text-sm text-red-500">
          {generateItems.error?.message || '일정 재생성에 실패했습니다.'}
        </p>
      )}
    </>
  );
}
