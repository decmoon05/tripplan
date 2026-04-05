'use client';

import type { TravelPace } from '@/types/database';

interface PaceStepProps {
  value: TravelPace | '';
  onChange: (pace: TravelPace) => void;
}

const PACE_OPTIONS: { value: TravelPace; label: string; description: string }[] = [
  { value: 'relaxed', label: '여유로운', description: '하루 2~3곳, 충분한 휴식과 여유를 즐기는 스타일' },
  { value: 'moderate', label: '보통', description: '하루 4~5곳, 관광과 휴식의 균형을 맞추는 스타일' },
  { value: 'active', label: '활동적인', description: '하루 6곳 이상, 최대한 많이 보고 경험하는 스타일' },
];

export function PaceStep({ value, onChange }: PaceStepProps) {
  return (
    <div className="space-y-8">
      <h2 className="text-4xl font-light tracking-tight">여행 페이스를 선택해주세요</h2>
      <div className="flex gap-3">
        {PACE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 py-4 rounded-xl border capitalize transition-all ${
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
