'use client';

import { Check } from 'lucide-react';

const FOOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'vegetarian', label: '채식주의' },
  { value: 'vegan', label: '비건' },
  { value: 'halal', label: '할랄' },
  { value: 'no-seafood', label: '해산물 제외' },
  { value: 'no-spicy', label: '맵지 않게' },
  { value: 'no-dairy', label: '유제품 제외' },
  { value: 'no-gluten', label: '글루텐 프리' },
  { value: 'no-pork', label: '돼지고기 제외' },
];

interface FoodStepProps {
  value: string[];
  onChange: (preferences: string[]) => void;
  customValue?: string;
  onCustomChange?: (value: string) => void;
}

export function FoodStep({ value, onChange, customValue, onCustomChange }: FoodStepProps) {
  const togglePreference = (pref: string) => {
    if (value.includes(pref)) {
      onChange(value.filter((v) => v !== pref));
    } else {
      onChange([...value, pref]);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-4xl font-light tracking-tight">식성을 알려주세요</h2>
      <div className="grid grid-cols-2 gap-3">
        {FOOD_OPTIONS.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => togglePreference(option.value)}
              className={`flex items-center justify-between px-6 py-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <span>{option.label}</span>
              {isSelected && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>

      {/* 기타 자유 입력 */}
      {onCustomChange !== undefined && (
        <input
          type="text"
          placeholder="예: 견과류 알레르기, 저염식 선호"
          value={customValue || ''}
          onChange={(e) => onCustomChange(e.target.value)}
          maxLength={100}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500"
        />
      )}
    </div>
  );
}
