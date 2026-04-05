'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { PlacePreference } from '@/types/database';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { LoadingSteps } from '@/components/ui/LoadingSteps';

interface PopularPlace {
  name: string;
  category: string;
  description: string;
  activityLevel?: 'light' | 'moderate' | 'intense';
  googlePlaceId?: string;
  address?: string;
  rating?: number;
  verified?: boolean;
  photoReference?: string | null;
}

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  attraction: 'bg-blue-500/20',
  restaurant: 'bg-orange-500/20',
  cafe: 'bg-amber-500/20',
  shopping: 'bg-pink-500/20',
  hotel: 'bg-emerald-500/20',
};

const CATEGORY_ICONS: Record<string, string> = {
  attraction: '\u{1F3DB}',
  restaurant: '\u{1F37D}',
  cafe: '\u2615',
  shopping: '\u{1F6CD}',
  hotel: '\u{1F3E8}',
};

/** Google Places (New) API Photo URL 생성 */
function getPhotoUrl(photoReference: string, maxWidth = 400): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) return '';
  return `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}

const ACTIVITY_BADGE: Record<string, { label: string; className: string }> = {
  light: { label: '가벼운', className: 'bg-emerald-500/20 text-emerald-400' },
  moderate: { label: '보통', className: 'bg-amber-500/20 text-amber-400' },
  intense: { label: '활동적', className: 'bg-rose-500/20 text-rose-400' },
};

interface PlaceSelection {
  placeName: string;
  preference: PlacePreference;
}

interface PlaceExperienceCardsProps {
  destination: string;
  onComplete: (selections: PlaceSelection[]) => void;
  onSkip: () => void;
}

const PREFERENCE_OPTIONS: { value: PlacePreference; label: string; color: string; bgColor: string }[] = [
  { value: 'exclude', label: '안 갈래요', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
  { value: 'revisit', label: '또 갈래요', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  { value: 'new', label: '안 가봤어요', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
];

export function PlaceExperienceCards({ destination, onComplete, onSkip }: PlaceExperienceCardsProps) {
  const [places, setPlaces] = useState<PopularPlace[]>([]);
  const [selections, setSelections] = useState<Record<string, PlacePreference>>({});
  const [hideExcluded, setHideExcluded] = useState(false);
  const [previouslyExcluded, setPreviouslyExcluded] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [previousTrips, setPreviousTrips] = useState<{ tripId: string; destination: string; startDate: string }[]>([]);
  const [previousVisits, setPreviousVisits] = useState<{ placeNameSnapshot: string; rating: number | null; memo: string | null }[]>([]);

  useEffect(() => {
    async function fetchPlaces() {
      setIsLoading(true);
      setError('');
      try {
        // 이전 여행 이력 조회
        try {
          const historyRes = await fetch(`/api/v1/trips/history?destination=${encodeURIComponent(destination)}`);
          if (historyRes.ok) {
            const historyJson = await historyRes.json();
            if (historyJson.data?.trips?.length > 0) {
              setPreviousTrips(historyJson.data.trips);
              setPreviousVisits(historyJson.data.visitedPlaces || []);

              // 이전 방문 장소를 자동으로 선호도에 반영
              const autoSelections: Record<string, PlacePreference> = {};
              for (const visit of historyJson.data.visitedPlaces || []) {
                if (visit.rating && visit.rating >= 4) {
                  autoSelections[visit.placeNameSnapshot] = 'revisit';
                } else if (visit.rating && visit.rating <= 2) {
                  autoSelections[visit.placeNameSnapshot] = 'exclude';
                }
                // 3점/미평가는 중립 (AI 판단에 맡김)
              }
              setSelections((prev) => ({ ...autoSelections, ...prev }));
            }
          }
        } catch {
          // 이전 여행 조회 실패는 무시
        }

        // 기존 선호도 먼저 불러오기
        const prefsRes = await fetch(`/api/v1/place-preferences?destination=${encodeURIComponent(destination)}`);
        const prefsJson = await prefsRes.json();
        const existing: Record<string, PlacePreference> = {};
        const excluded = new Set<string>();

        if (prefsRes.ok && prefsJson.data) {
          for (const pref of prefsJson.data) {
            if (pref.preference === 'exclude' || pref.preference === 'hidden') {
              excluded.add(pref.placeName);
            } else {
              existing[pref.placeName] = pref.preference;
            }
          }
        }
        setPreviouslyExcluded(excluded);
        setSelections((prev) => ({ ...prev, ...existing }));

        // 인기 장소 불러오기 (서버에서는 필터링하지 않고 전부 가져옴)
        const res = await fetch(`/api/v1/ai/popular-places?destination=${encodeURIComponent(destination)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || '장소 조회 실패');
        setPlaces(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '장소를 불러오지 못했습니다');
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlaces();
  }, [destination]);

  const handleSelect = (placeName: string, preference: PlacePreference) => {
    setSelections((prev) => {
      if (prev[placeName] === preference) {
        const next = { ...prev };
        delete next[placeName];
        return next;
      }
      return { ...prev, [placeName]: preference };
    });
  };

  const handleComplete = () => {
    const result: PlaceSelection[] = Object.entries(selections).map(([placeName, preference]) => ({
      placeName,
      preference,
    }));
    // 이전에 exclude한 장소도 결과에 포함 (AI가 제외할 수 있도록)
    for (const name of previouslyExcluded) {
      if (!selections[name]) {
        result.push({ placeName: name, preference: 'exclude' });
      }
    }
    onComplete(result);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <LoadingSteps
          title={`${destination} 인기 장소 탐색 중`}
          steps={[
            `${destination}의 관광 명소를 검색하고 있습니다`,
            '현지인 추천 맛집과 카페를 찾고 있습니다',
            '쇼핑 거리와 전통 시장을 확인하는 중',
            '최종 인기 장소 리스트를 정리하고 있습니다',
          ]}
          intervalMs={3000}
        />
        <button
          type="button"
          onClick={onSkip}
          className="mt-6 w-full rounded-full border border-white/10 py-3 text-sm font-medium text-white/50 transition hover:bg-white/5"
        >
          건너뛰고 바로 일정 생성
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 text-sm text-orange-500 hover:text-orange-400"
        >
          건너뛰고 일정 생성
        </button>
      </div>
    );
  }

  const excludeCount = Object.values(selections).filter((v) => v === 'exclude').length;

  // "표시 안하기" 체크 시 이전에 제외한 장소 숨김
  const visiblePlaces = hideExcluded
    ? places.filter((p) => !previouslyExcluded.has(p.name))
    : places;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h2 className="text-xl font-bold text-white">{destination} 인기 장소</h2>
      <p className="mt-1 text-sm text-white/50">
        가본 적 있는 장소를 선택하면 AI가 참고하여 일정을 만듭니다
      </p>

      {previousTrips.length > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm font-medium text-blue-300">
            🗓️ 이전에 {previousTrips[0].destination}을 방문하셨네요! ({previousTrips[0].startDate.slice(0, 7)})
          </p>
          <p className="text-xs text-blue-300/70 mt-1">
            방문 이력 {previousVisits.length}곳이 AI에 자동 반영됩니다.
            {previousVisits.filter(v => v.rating && v.rating >= 4).length > 0 && (
              <> 만족도 높은 {previousVisits.filter(v => v.rating && v.rating >= 4).length}곳은 &quot;또 갈래요&quot;로 설정됨.</>
            )}
          </p>
        </div>
      )}

      {previouslyExcluded.size > 0 && (
        <label className="mt-3 flex items-center gap-2 text-xs text-white/40 cursor-pointer">
          <input
            type="checkbox"
            checked={hideExcluded}
            onChange={(e) => setHideExcluded(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          이전에 &quot;안 갈래요&quot; 선택한 장소 숨기기 ({previouslyExcluded.size}개)
        </label>
      )}

      {excludeCount > 0 && (
        <p className="mt-2 text-xs text-red-400">
          &quot;안 갈래요&quot; {excludeCount}개 — 이번 일정에서 제외됩니다
        </p>
      )}

      <div className="mt-4 space-y-3">
        {visiblePlaces.map((place) => {
          const selected = selections[place.name];
          const wasExcluded = previouslyExcluded.has(place.name);
          return (
            <div
              key={place.name}
              className={`rounded-2xl border overflow-hidden transition ${
                selected === 'exclude'
                  ? 'border-red-500/30 bg-red-500/10'
                  : selected === 'revisit'
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-white/10 bg-white/5'
              }`}
            >
              {/* 썸네일 이미지 */}
              {place.photoReference ? (
                <div className="relative h-32 w-full bg-white/5">
                  <img
                    src={getPhotoUrl(place.photoReference)}
                    alt={place.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <span className="text-sm font-medium text-white">{place.name}</span>
                  </div>
                </div>
              ) : (
                <div className={`flex h-16 items-center justify-center ${CATEGORY_FALLBACK_COLORS[place.category] || 'bg-white/5'}`}>
                  <span className="text-2xl">{CATEGORY_ICONS[place.category] || '\u{1F4CD}'}</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!place.photoReference && <span className="font-medium text-white">{place.name}</span>}
                      {place.photoReference && <span className="font-medium text-sm text-white">{place.name}</span>}
                      <CategoryBadge category={place.category} />
                      {place.activityLevel && ACTIVITY_BADGE[place.activityLevel] && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTIVITY_BADGE[place.activityLevel].className}`}>
                          {ACTIVITY_BADGE[place.activityLevel].label}
                        </span>
                      )}
                      {place.verified && (
                        <span className="text-green-400 text-[10px]" title="Google Maps 검증">✓</span>
                      )}
                      {place.rating && (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                          ★ {place.rating.toFixed(1)}
                        </span>
                      )}
                      {wasExcluded && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">이전 제외</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white/40">
                      {place.description || (place.address ? place.address : `${place.category === 'restaurant' ? '인기 맛집' : place.category === 'cafe' ? '인기 카페' : place.category === 'shopping' ? '인기 쇼핑' : '인기 명소'}`)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {PREFERENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(place.name, opt.value)}
                      className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition ${
                        selected === opt.value
                          ? `${opt.bgColor} ${opt.color}`
                          : 'border-white/10 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {visiblePlaces.length === 0 && (
          <p className="py-8 text-center text-sm text-white/40">
            {hideExcluded ? '모든 장소가 이전에 제외되었습니다. 체크 해제하면 다시 볼 수 있습니다.' : '이 목적지의 인기 장소 데이터가 없습니다.'}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-full border border-white/10 py-3 font-medium text-white/50 hover:bg-white/10 transition"
        >
          건너뛰기
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="flex-1 rounded-full bg-white py-3 font-medium text-black transition hover:bg-white/90"
        >
          선택 완료 → 일정 생성
        </button>
      </div>
    </div>
  );
}
