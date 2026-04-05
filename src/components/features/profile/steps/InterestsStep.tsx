'use client';

interface InterestsStepProps {
  value: string[];
  onChange: (interests: string[]) => void;
  customValue?: string;
  onCustomChange?: (value: string) => void;
}

const INTEREST_GROUPS: { label: string; items: { value: string; label: string }[] }[] = [
  {
    label: '콘텐츠/문화',
    items: [
      { value: 'anime', label: '애니메이션' },
      { value: 'drama', label: '드라마 촬영지' },
      { value: 'kpop', label: 'K-POP' },
      { value: 'jpop', label: 'J-POP' },
      { value: 'film-location', label: '영화 촬영지' },
    ],
  },
  {
    label: '역사/예술',
    items: [
      { value: 'history', label: '역사 유적' },
      { value: 'art', label: '미술/갤러리' },
      { value: 'museum', label: '박물관' },
      { value: 'architecture', label: '건축물' },
      { value: 'temple', label: '사찰/신사' },
      { value: 'shrine', label: '신사' },
      { value: 'religious', label: '종교 명소' },
    ],
  },
  {
    label: '자연/액티비티',
    items: [
      { value: 'nature', label: '자연 경관' },
      { value: 'hiking', label: '하이킹/트레킹' },
      { value: 'beach', label: '해변' },
      { value: 'hot-spring', label: '온천' },
      { value: 'theme-park', label: '테마파크' },
      { value: 'sports', label: '스포츠' },
      { value: 'surfing', label: '서핑' },
      { value: 'skiing', label: '스키' },
      { value: 'golf', label: '골프' },
    ],
  },
  {
    label: '먹거리',
    items: [
      { value: 'local-food', label: '현지 로컬 맛집' },
      { value: 'street-food', label: '길거리 음식' },
      { value: 'fine-dining', label: '파인다이닝' },
      { value: 'cooking-class', label: '쿠킹 클래스' },
    ],
  },
  {
    label: '쇼핑/라이프',
    items: [
      { value: 'photo-spot', label: '포토 스팟' },
      { value: 'shopping-luxury', label: '명품 쇼핑' },
      { value: 'shopping-vintage', label: '빈티지/중고' },
      { value: 'flea-market', label: '플리마켓' },
      { value: 'nightlife', label: '나이트라이프' },
      { value: 'festival', label: '축제/이벤트' },
    ],
  },
];

export function InterestsStep({ value, onChange, customValue, onCustomChange }: InterestsStepProps) {
  const toggle = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter((v) => v !== interest));
    } else if (value.length < 10) {
      onChange([...value, interest]);
    }
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <h2 className="text-4xl font-light tracking-tight">관심사를 선택해주세요</h2>

      {INTEREST_GROUPS.map((group) => (
        <div key={group.label} className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-white/40">{group.label}</h3>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const isSelected = value.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggle(item.value)}
                  disabled={!isSelected && value.length >= 10}
                  className={`px-4 py-2 rounded-full border text-sm transition-all ${
                    isSelected
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 기타 자유 입력 */}
      {onCustomChange !== undefined && (
        <input
          type="text"
          placeholder="예: 와이너리 투어, 도자기 체험, 야시장"
          value={customValue || ''}
          onChange={(e) => onCustomChange(e.target.value)}
          maxLength={200}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500"
        />
      )}
    </div>
  );
}
