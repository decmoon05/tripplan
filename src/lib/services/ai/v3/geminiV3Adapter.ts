/**
 * v3 Gemini 어댑터 — v3 타입으로 Gemini를 호출
 *
 * 기존 gemini.provider.ts의 callGemini/callGeminiWithRetry를 재사용하되,
 * v3 전용 responseSchema를 사용한다.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getGeminiMainModel, estimateCost } from '../models';
import type { AIPlaceRecommendation, AIV3Response } from './types';

// ---------------------------------------------------------------------------
// v3 전용 Response Schema
// ---------------------------------------------------------------------------

const V3_PLACE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    placeNameSnapshot: { type: Type.STRING },
    category: { type: Type.STRING, enum: ['attraction', 'restaurant', 'cafe', 'shopping'] },
    notes: { type: Type.STRING, description: 'ONE short Korean sentence, max 15 chars' },
    reasonTags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Exactly 2 Korean tags' },
    mealSlot: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'none'] },
    estimatedDurationMinutes: { type: Type.INTEGER },
    estimatedCost: { type: Type.INTEGER },
    timePreference: { type: Type.STRING, enum: ['morning', 'afternoon', 'evening', 'anytime'] },
  },
  required: ['placeNameSnapshot', 'category', 'notes', 'reasonTags', 'mealSlot', 'estimatedDurationMinutes', 'estimatedCost', 'timePreference'],
};

const V3_ADVISORIES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    weather: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
    safety: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
    health: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
    transport: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
    culture: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
    budget: { type: Type.STRING, nullable: true, description: 'Max 30 chars Korean' },
  },
};

const V3_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    places: { type: Type.ARRAY, items: V3_PLACE_SCHEMA },
    // tripSummary, advisories 제거 — 토큰 절약 (장소만 받기)
    // 필요하면 별도 경량 호출로 가져옴
  },
  required: ['places'],
};

const V3_SUPPLEMENT_SCHEMA = {
  type: Type.ARRAY,
  items: V3_PLACE_SCHEMA,
};

// ---------------------------------------------------------------------------
// 멀티 키 로테이션 (gemini.provider.ts에서 복제 — 순환 의존 방지)
// ---------------------------------------------------------------------------

function getApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return raw.split(',').map(k => k.trim()).filter(k => k.length > 10);
}

let currentKeyIndex = 0;

function getClient(): GoogleGenAI {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');
  const key = keys[currentKeyIndex % keys.length];
  return new GoogleGenAI({ apiKey: key });
}

function rotateKey(): boolean {
  const keys = getApiKeys();
  if (keys.length <= 1) return false;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return true;
}

// ---------------------------------------------------------------------------
// v3 Gemini 호출
// ---------------------------------------------------------------------------

/**
 * v3 장소 추천 호출 — AIV3Response 반환
 */
export async function callGeminiForV3(
  systemPrompt: string,
  userPrompt: string,
): Promise<AIV3Response> {
  const model = getGeminiMainModel();
  const maxRetries = getApiKeys().length;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: V3_RESPONSE_SCHEMA,
          maxOutputTokens: 32768, // 3-flash가 notes를 길게 쓰는 경향 → 32K
        },
      });

      const text = response.text;
      if (!text) throw new Error('Gemini returned empty');

      let parsed: AIV3Response;
      try {
        parsed = JSON.parse(text) as AIV3Response;
      } catch (parseErr) {
        // JSON 잘림 → maxOutputTokens 올려서 1회 재시도
        if (String(parseErr).includes('Unterminated') || String(parseErr).includes('position')) {
          console.warn(`[v3 Gemini] JSON 잘림 감지 (${text.length}자) → 131072 토큰으로 재시도`);
          const retryAi = getClient();
          const retryResponse = await retryAi.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              responseSchema: V3_RESPONSE_SCHEMA,
              maxOutputTokens: 65536, // 재시도 시 2배
            },
          });
          const retryText = retryResponse.text;
          if (!retryText) throw new Error('Gemini retry returned empty');
          parsed = JSON.parse(retryText) as AIV3Response;
        } else {
          throw parseErr;
        }
      }

      if (!parsed.places || !Array.isArray(parsed.places)) {
        throw new Error('Gemini response missing places array');
      }

      // 실제 토큰 수 + 비용 추출
      const usage = (response as any).usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? usage?.inputTokens ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? usage?.outputTokens ?? 0;
      const cost = estimateCost(model, inputTokens, outputTokens);

      parsed._usage = {
        inputTokens,
        outputTokens,
        model,
        costUSD: Math.round(cost.totalCost * 10000) / 10000,
      };

      console.log(`[v3 Gemini] ${parsed.places.length}개 장소 수신 (${model}) | ${inputTokens} in + ${outputTokens} out = $${parsed._usage.costUSD}`);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) && attempt < maxRetries - 1) {
        if (rotateKey()) {
          console.warn(`[v3 Gemini] 429 → 키 로테이션 (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error('v3 Gemini: 모든 키 소진');
}

/**
 * v3 식사 보충 호출 — AIPlaceRecommendation[] 반환
 */
export async function callGeminiForV3Supplement(
  prompt: string,
): Promise<{ places: AIPlaceRecommendation[]; inputTokens: number; outputTokens: number; costUSD: number }> {
  const model = getGeminiMainModel();
  const ai = getClient();

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: V3_SUPPLEMENT_SCHEMA,
      maxOutputTokens: 4096,
    },
  });

  const text = response.text;
  if (!text) return { places: [], inputTokens: 0, outputTokens: 0, costUSD: 0 };

  const parsed = JSON.parse(text);
  const places = Array.isArray(parsed) ? parsed : [];

  const usage = (response as any).usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const cost = estimateCost(model, inputTokens, outputTokens);

  console.log(`[v3 Gemini Supplement] ${places.length}개 식당 | ${inputTokens} in + ${outputTokens} out = $${cost.totalCost.toFixed(4)}`);

  return { places, inputTokens, outputTokens, costUSD: Math.round(cost.totalCost * 10000) / 10000 };
}
