'use client';

interface SpecialNoteStepProps {
  value: string;
  onChange: (note: string) => void;
}

const EXAMPLES = [
  '주술회전 성지순례 코스 넣어주세요',
  '아이가 4살이라 유모차 접근 가능한 곳 위주로',
  '사진 찍기 좋은 인스타 감성 장소 많이',
  '현지인만 아는 숨은 맛집 위주로 추천해주세요',
  '체력이 약해서 걷는 거리 최소화해주세요',
  '한국어 메뉴판 있는 식당 우선',
];

export function SpecialNoteStep({ value, onChange }: SpecialNoteStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-4xl font-light tracking-tight">특별히 원하는 게 있나요?</h2>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        placeholder="예: 원피스 성지순례 코스 넣어주세요, 또는 아이가 좋아하는 캐릭터 샵 위주로..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 h-40 resize-none"
      />

      <div>
        <p className="text-xs uppercase tracking-widest text-white/40 mb-3">이런 것도 가능해요</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                const newValue = value ? `${value}\n${ex}` : ex;
                if (newValue.length <= 500) onChange(newValue);
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/40 hover:border-orange-500 hover:text-orange-400 transition"
            >
              {ex.length > 25 ? ex.slice(0, 25) + '...' : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
