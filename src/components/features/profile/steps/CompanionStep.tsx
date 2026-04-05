'use client';

import type { CompanionType } from '@/types/database';

interface CompanionStepProps {
  value: CompanionType | '';
  onChange: (companion: CompanionType) => void;
}

const COMPANION_OPTIONS: { value: CompanionType; label: string; description: string }[] = [
  { value: 'solo', label: '혼자', description: '자유로운 1인 여행' },
  { value: 'couple', label: '연인/부부', description: '로맨틱한 둘만의 여행' },
  { value: 'friends', label: '친구', description: '친구들과 함께' },
  { value: 'family', label: '가족 (성인)', description: '부모님/형제 등 성인 가족' },
  { value: 'family-kids', label: '가족 (아이 동반)', description: '어린 자녀와 함께하는 여행' },
  { value: 'business', label: '출장/워케이션', description: '업무 겸 여행' },
  { value: 'other', label: '기타', description: '위에 해당하지 않는 경우' },
];

export function CompanionStep({ value, onChange }: CompanionStepProps) {
  return (
    <div className="space-y-8">
      <h2 className="text-4xl font-light tracking-tight">이번 여행, 누구와 가나요?</h2>
      <div className="flex gap-3 flex-wrap">
        {COMPANION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 min-w-[120px] py-4 rounded-xl border capitalize transition-all ${
              value === option.value
                ? 'bg-white text-black border-white'
                : 'bg-white/5 border-white/10 text-white/60'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
