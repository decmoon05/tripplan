'use client';

import type { BudgetRange } from '@/types/database';

interface BudgetStepProps {
  value: BudgetRange | '';
  onChange: (budget: BudgetRange) => void;
}

const BUDGET_OPTIONS: { value: BudgetRange; label: string; description: string }[] = [
  { value: 'backpacking', label: '배낭여행', description: '호스텔, 길거리 음식, 도보 위주' },
  { value: 'budget', label: '절약형', description: '저렴한 숙소, 로컬 음식, 대중교통 위주' },
  { value: 'moderate', label: '보통', description: '적당한 숙소, 맛집 탐방, 편리한 이동' },
  { value: 'comfort', label: '편안한', description: '좋은 호텔, 맛집, 택시 이용' },
  { value: 'luxury', label: '럭셔리', description: '고급 숙소, 파인다이닝, 프리미엄 경험' },
];

export function BudgetStep({ value, onChange }: BudgetStepProps) {
  return (
    <div className="space-y-8">
      <h2 className="text-4xl font-light tracking-tight">예산 범위를 선택해주세요</h2>
      <div className="grid grid-cols-3 gap-3">
        {BUDGET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`py-3 px-2 rounded-xl border capitalize transition-all text-sm ${
              value === option.value
                ? 'bg-white text-black border-white font-medium'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            <div>{option.label}</div>
            <div className={`text-xs mt-1 ${value === option.value ? 'text-black/50' : 'text-white/30'}`}>
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
