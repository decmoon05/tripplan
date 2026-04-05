'use client';

import { MBTI_TYPES } from '@/lib/validators/profile';

interface MbtiStepProps {
  value: string;
  onChange: (mbti: string) => void;
}

export function MbtiStep({ value, onChange }: MbtiStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-4xl font-light tracking-tight">MBTI를 선택해주세요</h2>
      <div className="grid grid-cols-4 gap-3">
        {MBTI_TYPES.map((mbti) => (
          <button
            key={mbti}
            type="button"
            onClick={() => onChange(mbti)}
            className={`py-3 rounded-xl border transition-all ${
              value === mbti
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
            }`}
          >
            {mbti}
          </button>
        ))}
      </div>
    </div>
  );
}
