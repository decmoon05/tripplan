/**
 * v4 AI 호출 어댑터
 *
 * Gemini에게 장소 추천을 요청하고 결과를 PlaceCandidate[]로 반환.
 * retry + key rotation + JSON 잘림 감지 패턴은 v3 geminiV3Adapter에서 가져옴.
 * responseSchema는 v4 PlaceCandidate에 맞게 새로 정의.
 */

import { getGeminiClient, rotateGeminiKey, getGeminiKeyCount } from '@/lib/services/ai/utils/geminiClient';
import { getGeminiMainModel, estimateCost } from '@/lib/services/ai/models';
import { PLACE_RESPONSE_SCHEMA } from './promptPlanner';
import type { PlaceCandidate, TimeProfile } from './types';

export interface AIPlaceResponse {
  places: PlaceCandidate[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    model: string;
    costUSD: number;
  };
}

interface RawAIPlace {
  placeNameSnapshot: string;
  category: string;
  reasonTags: string[];
  mealSlot: string;
  estimatedDurationMinutes: number;
  estimatedCost: number;
  timePreference: string;
  aiConfidence: number;
  timeVector: TimeProfile;
  weatherSensitivity: number;
  notes?: string;
}

/**
 * Gemini에게 장소 추천 요청.
 * retry(키 로테이션) + JSON 잘림 자동 재시도.
 */
export async function callGeminiForPlaces(
  system: string,
  user: string,
): Promise<AIPlaceResponse> {
  const model = getGeminiMainModel();
  const maxRetries = Math.max(getGeminiKeyCount(), 2);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json' as const,
          responseSchema: PLACE_RESPONSE_SCHEMA,
          maxOutputTokens: 16384,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Gemini returned empty');

      let parsed: { places: RawAIPlace[] };
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        // JSON 잘림 → maxOutputTokens 2배로 재시도
        if (String(parseErr).includes('Unterminated') || String(parseErr).includes('position')) {
          console.warn(`[v4 AI] JSON 잘림 감지 (${text.length}자) → 32768 토큰으로 재시도`);
          const retryAi = getGeminiClient();
          const retryResponse = await retryAi.models.generateContent({
            model,
            contents: user,
            config: {
              systemInstruction: system,
              responseMimeType: 'application/json' as const,
              responseSchema: PLACE_RESPONSE_SCHEMA,
              maxOutputTokens: 32768,
            },
          });
          const retryText = retryResponse.text;
          if (!retryText) throw new Error('Gemini retry returned empty');
          parsed = JSON.parse(retryText);
        } else {
          throw parseErr;
        }
      }

      if (!parsed.places || !Array.isArray(parsed.places)) {
        throw new Error('Gemini response missing places array');
      }

      // 토큰 + 비용 추출
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usage = (response as any).usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? usage?.inputTokens ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? usage?.outputTokens ?? 0;
      const cost = estimateCost(model, inputTokens, outputTokens);

      // RawAIPlace → PlaceCandidate 변환 (검증 전 초기 상태)
      const places: PlaceCandidate[] = parsed.places.map((raw) => ({
        placeNameSnapshot: raw.placeNameSnapshot,
        category: (raw.category as PlaceCandidate['category']) || 'attraction',
        reasonTags: raw.reasonTags || [],
        mealSlot: (raw.mealSlot as PlaceCandidate['mealSlot']) || 'none',
        estimatedDurationMinutes: clamp(raw.estimatedDurationMinutes || 60, 15, 480),
        estimatedCost: Math.max(0, raw.estimatedCost || 0),
        timePreference: (raw.timePreference as PlaceCandidate['timePreference']) || 'anytime',
        aiConfidence: clamp(raw.aiConfidence ?? 0.5, 0, 1),
        placeConfidence: 'unverified' as const,
        timeVector: raw.timeVector || { earlyMorning: 0.5, morning: 0.5, afternoon: 0.5, lateAfternoon: 0.5, evening: 0.5, night: 0.5 },
        weatherSensitivity: clamp(raw.weatherSensitivity ?? 0.5, 0, 1),
        dataSource: 'ai' as const,
        latitude: null,
        longitude: null,
        address: null,
        businessHours: null,
        closedDays: null,
        rating: null,
        googlePlaceId: null,
        verified: false,
        areaId: '',  // 호출자가 설정
      }));

      const costUSD = Math.round(cost.totalCost * 10000) / 10000;
      console.log(`[v4 AI] ${places.length}개 장소 수신 (${model}) | ${inputTokens} in + ${outputTokens} out = $${costUSD}`);

      return {
        places,
        usage: { inputTokens, outputTokens, model, costUSD },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempt < maxRetries - 1) {
        if (rotateGeminiKey()) {
          console.warn(`[v4 AI] 429 → 키 로테이션 (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error('v4 AI: 모든 키 소진');
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
