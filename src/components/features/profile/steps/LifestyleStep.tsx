'use client';

export interface LifestyleAnswers {
  morningType: 'early' | 'moderate' | 'late' | '';
  stamina: 'high' | 'moderate' | 'low' | '';
  adventureLevel: 'explorer' | 'balanced' | 'cautious' | '';
  photoStyle: 'sns' | 'casual' | 'minimal' | '';
}

interface LifestyleQuestion {
  key: keyof LifestyleAnswers;
  label: string;
  options: { value: string; label: string }[];
}

const QUESTIONS: LifestyleQuestion[] = [
  {
    key: 'morningType',
    label: 'Morning Type',
    options: [
      { value: 'early', label: 'early' },
      { value: 'moderate', label: 'moderate' },
      { value: 'late', label: 'late' },
    ],
  },
  {
    key: 'stamina',
    label: 'Stamina',
    options: [
      { value: 'high', label: 'high' },
      { value: 'moderate', label: 'moderate' },
      { value: 'low', label: 'low' },
    ],
  },
  {
    key: 'adventureLevel',
    label: 'Adventure Level',
    options: [
      { value: 'explorer', label: 'explorer' },
      { value: 'balanced', label: 'balanced' },
      { value: 'cautious', label: 'cautious' },
    ],
  },
  {
    key: 'photoStyle',
    label: 'Photo Style',
    options: [
      { value: 'sns', label: 'sns' },
      { value: 'casual', label: 'casual' },
      { value: 'minimal', label: 'minimal' },
    ],
  },
];

interface LifestyleStepProps {
  value: LifestyleAnswers;
  onChange: (answers: LifestyleAnswers) => void;
}

export function LifestyleStep({ value, onChange }: LifestyleStepProps) {
  const handleSelect = (key: keyof LifestyleAnswers, selected: string) => {
    onChange({ ...value, [key]: selected });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-4xl font-light tracking-tight">Your Travel Lifestyle</h2>

      {QUESTIONS.map((q) => (
        <div key={q.key} className="space-y-4">
          <label className="text-xs uppercase tracking-widest text-white/40 block">{q.label}</label>
          <div className="flex gap-3">
            {q.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(q.key, opt.value)}
                className={`flex-1 py-4 rounded-xl border capitalize transition-all ${
                  value[q.key] === opt.value
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
