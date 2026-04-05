import type { TripItem, PlacePreference } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { AIProvider, AIProviderType, AIProviderStreaming, AIGenerateResult, GenerateInput, VerifiedPlace, PreviousVisit, StreamChunk } from './ai/types';
import { getDayCount } from '@/utils/date';
import { generateId } from '@/utils/id';

const DESTINATION_CURRENCY: Record<string, string> = {
  '일본': 'JPY', 'japan': 'JPY', '도쿄': 'JPY', 'tokyo': 'JPY', '오사카': 'JPY', 'osaka': 'JPY',
  '교토': 'JPY', 'kyoto': 'JPY', '후쿠오카': 'JPY', 'fukuoka': 'JPY', '삿포로': 'JPY', 'sapporo': 'JPY',
  '태국': 'THB', 'thailand': 'THB', '방콕': 'THB', 'bangkok': 'THB',
  '미국': 'USD', 'usa': 'USD', '뉴욕': 'USD', '하와이': 'USD', '괌': 'USD',
  '영국': 'GBP', '런던': 'GBP', 'london': 'GBP',
  '프랑스': 'EUR', '파리': 'EUR', 'paris': 'EUR',
  '독일': 'EUR', '이탈리아': 'EUR', '스페인': 'EUR',
  '베트남': 'VND', '하노이': 'VND', '호치민': 'VND', '다낭': 'VND',
  '대만': 'TWD', '타이베이': 'TWD', 'taipei': 'TWD',
  '싱가포르': 'SGD', 'singapore': 'SGD',
  '호주': 'AUD', '시드니': 'AUD', 'sydney': 'AUD',
  '중국': 'CNY', '상하이': 'CNY', '베이징': 'CNY',
  '필리핀': 'PHP', '세부': 'PHP', '마닐라': 'PHP',
};

function detectCurrency(destination: string): string {
  const dest = destination.toLowerCase();
  for (const [key, currency] of Object.entries(DESTINATION_CURRENCY)) {
    if (dest.includes(key.toLowerCase())) return currency;
  }
  return 'KRW';
}

// KRW 기준 비용 → 현지 통화로 변환 (AI 프롬프트용 근사값)
// 실시간 환율은 exchange.service.ts + /api/v1/exchange 에서 처리
// 아래 값은 AI 비용 추정에만 사용하므로 정확도보다 성능 우선
const KRW_TO_LOCAL: Record<string, number> = {
  KRW: 1, JPY: 0.105, USD: 0.00069, EUR: 0.00063, GBP: 0.00054,
  THB: 0.024, VND: 17.2, TWD: 0.022, SGD: 0.00093, CNY: 0.005,
  PHP: 0.04, AUD: 0.00106, CAD: 0.00095, MYR: 0.0032, IDR: 11.1,
};

function toLocalCost(krwCost: number, currency: string): number {
  const rate = KRW_TO_LOCAL[currency] || 1;
  if (currency === 'JPY') return Math.round(krwCost * rate / 100) * 100; // 100엔 단위
  if (currency === 'VND') return Math.round(krwCost * rate / 1000) * 1000;
  if (currency === 'IDR') return Math.round(krwCost * rate / 1000) * 1000;
  return Math.round(krwCost * rate);
}

function generateMockItemsForDay(
  dayNumber: number,
  profile: FullProfileInput,
  destination: string,
): TripItem[] {
  const currency = detectCurrency(destination);
  const baseItems = [
    { category: 'restaurant', startTime: '08:00', endTime: '09:00', notes: '아침 식사', cost: 12000 },
    { category: 'attraction', startTime: '09:30', endTime: '12:00', notes: '오전 관광', cost: 15000 },
    { category: 'restaurant', startTime: '12:30', endTime: '13:30', notes: '점심 식사', cost: 15000 },
    { category: 'attraction', startTime: '14:00', endTime: '17:00', notes: '오후 관광', cost: 10000 },
    { category: 'cafe', startTime: '17:30', endTime: '18:30', notes: '카페 휴식', cost: 7000 },
    { category: 'restaurant', startTime: '19:00', endTime: '20:30', notes: '저녁 식사', cost: 25000 },
  ];

  const budgetMultiplier = { budget: 0.6, moderate: 1, luxury: 2.5 }[profile.budgetRange];
  const paceItemCount = { relaxed: 4, moderate: 5, active: 6 }[profile.travelPace];

  return baseItems.slice(0, paceItemCount).map((base, i) => ({
    id: generateId('item'),
    tripId: '',
    dayNumber,
    orderIndex: i,
    placeId: '',
    placeNameSnapshot: `${destination} Day${dayNumber} - ${base.notes}`,
    category: base.category,
    startTime: base.startTime,
    endTime: base.endTime,
    estimatedCost: toLocalCost(Math.round(base.cost * budgetMultiplier), currency),
    currency,
    priceConfidence: 'estimated' as const,
    notes: base.notes,
    latitude: null,
    longitude: null,
    reasonTags: [],
    address: null,
    businessHours: null,
    closedDays: null,
    transitMode: null,
    transitDurationMin: null,
    transitSummary: null,
    verified: true,
    googlePlaceId: null,
    subActivities: null,
    createdAt: new Date().toISOString(),
  }));
}

// Mock 아이템의 활동 강도 매핑 (intense인 장소 식별용)
const MOCK_ACTIVITY_MAP: Record<string, 'light' | 'moderate' | 'intense'> = {
  '한라산 영실코스': 'intense',
  '성산일출봉': 'moderate',
  '우도': 'moderate',
};

// intense 장소의 대체 아이템 (stamina가 low/moderate일 때 사용)
const INTENSE_ALTERNATIVES: Record<string, Partial<TripItem>> = {
  '한라산 영실코스': {
    placeId: 'mock-place-manjanggul',
    placeNameSnapshot: '만장굴 (萬丈窟)',
    category: 'attraction',
    startTime: '09:00',
    endTime: '11:00',
    estimatedCost: 4000,
    notes: '세계 최장 용암동굴. 평탄한 탐방로, 체력 부담 없이 관람 가능. 내부 서늘하므로 겉옷 준비',
    latitude: 33.5282,
    longitude: 126.7714,
  },
};

function getMockProvider(): AIProvider {
  return {
    async generateItinerary(
      profile: FullProfileInput,
      input: GenerateInput,
      _placePreferences?: { placeName: string; preference: PlacePreference }[],
      _verifiedPlaces?: VerifiedPlace[],
    ): Promise<AIGenerateResult> {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const dest = input.destination.toLowerCase();
      const dayCount = getDayCount(input.startDate, input.endDate);
      const stamina = profile.lifestyle?.stamina || 'moderate';

      // 미리 만든 mock 데이터가 충분하면 사용, 부족하면 동적 생성
      const { mockTokyoItems, mockJejuItems } = await import('@/mocks/tripItems');
      let template = mockTokyoItems;
      if (dest.includes('제주') || dest.includes('jeju')) {
        template = mockJejuItems;
      }

      const templateMaxDay = Math.max(...template.map((i) => i.dayNumber));

      const items: TripItem[] = [];

      for (let day = 1; day <= dayCount; day++) {
        if (day <= templateMaxDay) {
          const dayItems = template
            .filter((item) => item.dayNumber === day)
            .map((item) => {
              const activity = MOCK_ACTIVITY_MAP[item.placeNameSnapshot] || 'light';

              // stamina가 high가 아닌데 intense 장소면 대체
              if (activity === 'intense' && stamina !== 'high') {
                const alt = INTENSE_ALTERNATIVES[item.placeNameSnapshot];
                if (alt) {
                  return {
                    id: generateId('item'),
                    tripId: '',
                    dayNumber: item.dayNumber,
                    orderIndex: item.orderIndex,
                    placeId: alt.placeId || '',
                    placeNameSnapshot: alt.placeNameSnapshot || item.placeNameSnapshot,
                    category: alt.category || item.category,
                    startTime: alt.startTime || item.startTime,
                    endTime: alt.endTime || item.endTime,
                    estimatedCost: alt.estimatedCost ?? item.estimatedCost,
                    currency: item.currency || 'KRW',
                    priceConfidence: item.priceConfidence || 'estimated',
                    notes: alt.notes || item.notes,
                    latitude: alt.latitude ?? item.latitude,
                    longitude: alt.longitude ?? item.longitude,
                    reasonTags: [],
                    address: null,
                    businessHours: null,
                    closedDays: null,
                    transitMode: null,
                    transitDurationMin: null,
                    transitSummary: null,
                    verified: true,
                    googlePlaceId: null,
                    subActivities: null,
                    createdAt: new Date().toISOString(),
                  };
                }
              }

              return {
                id: generateId('item'),
                tripId: '',
                dayNumber: item.dayNumber,
                orderIndex: item.orderIndex,
                placeId: item.placeId,
                placeNameSnapshot: item.placeNameSnapshot,
                category: item.category,
                startTime: item.startTime,
                endTime: item.endTime,
                estimatedCost: item.estimatedCost,
                currency: item.currency || 'KRW',
                priceConfidence: item.priceConfidence || 'estimated',
                notes: item.notes,
                latitude: item.latitude,
                longitude: item.longitude,
                reasonTags: item.reasonTags || [],
                address: item.address ?? null,
                businessHours: item.businessHours ?? null,
                closedDays: item.closedDays ?? null,
                transitMode: item.transitMode ?? null,
                transitDurationMin: item.transitDurationMin ?? null,
                transitSummary: item.transitSummary ?? null,
                verified: true,
                googlePlaceId: null,
                subActivities: null,
                createdAt: new Date().toISOString(),
              };
            });
          items.push(...dayItems);
        } else {
          items.push(...generateMockItemsForDay(day, profile, input.destination));
        }
      }

      return { items };
    },
  };
}

async function getProvider(type: AIProviderType): Promise<AIProvider> {
  switch (type) {
    case 'openai': {
      const { openaiProvider } = await import('./ai/openai.provider');
      return openaiProvider;
    }
    case 'claude': {
      const { claudeProvider } = await import('./ai/claude.provider');
      return claudeProvider;
    }
    case 'gemini': {
      const { geminiProvider } = await import('./ai/gemini.provider');
      return geminiProvider;
    }
    case 'mock':
    default:
      return getMockProvider();
  }
}

/** 폴백 체인 — 각 프로바이더 실패 시 다음 프로바이더로 */
const FALLBACK_CHAINS: Record<AIProviderType, AIProviderType[]> = {
  gemini: ['gemini', 'claude', 'openai'],
  claude: ['claude', 'gemini', 'openai'],
  openai: ['openai', 'claude', 'gemini'],
  mock: ['mock'],
};

export async function generateItinerary(
  profile: FullProfileInput,
  input: GenerateInput,
  placePreferences?: { placeName: string; preference: PlacePreference }[],
  verifiedPlaces?: VerifiedPlace[],
): Promise<AIGenerateResult> {
  const providerType = (process.env.AI_PROVIDER || 'mock') as AIProviderType;
  const chain = FALLBACK_CHAINS[providerType] || ['mock'];

  for (const type of chain) {
    try {
      console.log(`[AI] ${type} 프로바이더 시도`);
      const provider = await getProvider(type);
      return await provider.generateItinerary(profile, input, placePreferences, verifiedPlaces);
    } catch (error) {
      console.warn(`[AI] ${type} 실패:`, error instanceof Error ? error.message : error);
    }
  }

  // 모든 AI 프로바이더 실패 → mock 폴백
  console.warn('[AI] 모든 AI 프로바이더 실패, mock으로 폴백');
  const mockProvider = getMockProvider();
  return mockProvider.generateItinerary(profile, input, placePreferences, verifiedPlaces);
}

/**
 * 스트리밍 일정 생성 (Gemini 등 AIProviderStreaming 지원 프로바이더용).
 * 스트리밍 미지원 프로바이더는 비스트리밍 결과를 단일 complete 이벤트로 래핑.
 */
export async function* generateItineraryStream(
  profile: FullProfileInput,
  input: GenerateInput,
  placePreferences?: { placeName: string; preference: PlacePreference }[],
  verifiedPlaces?: VerifiedPlace[],
  previousVisits?: PreviousVisit[],
): AsyncGenerator<StreamChunk> {
  const providerType = (process.env.AI_PROVIDER || 'mock') as AIProviderType;
  const provider = await getProvider(providerType);

  // 이전 여행 경험이 있으면 progress로 알림
  if (previousVisits && previousVisits.length > 0) {
    yield { type: 'progress', message: `📋 이전 방문 ${previousVisits.length}곳 참조 중...` };
  }

  // 스트리밍 지원 프로바이더인지 확인
  if ('generateItineraryStream' in provider) {
    yield* (provider as AIProviderStreaming).generateItineraryStream(
      profile, input, placePreferences, verifiedPlaces, previousVisits,
    );
    return;
  }

  // 비스트리밍 폴백: 일반 호출 후 단일 complete 이벤트로 래핑
  yield { type: 'progress', message: '일정을 생성하고 있습니다...' };
  const result = await generateItinerary(profile, input, placePreferences, verifiedPlaces);
  yield { type: 'complete', result };
}
