/**
 * AI 모델 중앙 관리
 *
 * 모든 모델명과 가격은 이 파일에서만 관리한다.
 * 다른 파일에서 모델명을 하드코딩하지 말 것.
 *
 * 모델 변경: .env.local만 수정하면 전체 반영됨.
 * 가격 변경: MODEL_PRICING만 수정하면 estimate + debugLog에 반영됨.
 *
 * ⚠️ Gemini 3.1 Pro 사용 금지 (출력 $12~18/1M → 5만원 사고)
 */

// ---------------------------------------------------------------------------
// 모델 이름 해석 (전부 .env에서 읽음, fallback은 저렴한 모델로)
// ---------------------------------------------------------------------------

/** Gemini 메인 모델 (일정 생성) */
export function getGeminiMainModel(): string {
  const model = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-flash';
  // 안전장치: 비싼 모델 차단 (3-flash 가격 $0.50/$3.00 이상 금지)
  const blocked = ['3.1-pro', '2.5-pro', 'pro'];
  if (blocked.some(b => model.includes(b))) {
    console.warn(`[Models] ⚠️ ${model} 금지! gemini-2.5-flash로 강제 전환`);
    return 'gemini-2.5-flash';
  }
  return model;
}

/** Gemini 경량 모델 (fallback, 하위활동 등) */
export function getGeminiLiteModel(): string {
  return process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash-lite';
}

/** Claude 모델 */
export function getClaudeModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
}

/** OpenAI 메인 모델 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-5.4-mini';
}

/** OpenAI fallback 모델 */
export function getOpenAIFallbackModel(): string {
  return process.env.OPENAI_FALLBACK_MODEL || 'gpt-5-mini';
}

/** OpenAI 경량 모델 (nano) */
export function getOpenAILightModel(): string {
  return process.env.OPENAI_LIGHT_MODEL || 'gpt-5.4-nano';
}

/** 현재 활성 프로바이더 */
export function getActiveProvider(): string {
  return process.env.AI_PROVIDER || 'gemini';
}

/** 현재 프로바이더의 메인 모델명 */
export function getCurrentModelName(): string {
  const provider = getActiveProvider();
  switch (provider) {
    case 'gemini': return getGeminiMainModel();
    case 'claude': return getClaudeModel();
    case 'openai': return getOpenAIModel();
    default: return provider;
  }
}

// ---------------------------------------------------------------------------
// 가격표 ($/1M 토큰, 2026.03 기준)
// ---------------------------------------------------------------------------

export interface ModelPricing {
  input: number;   // $/1M input tokens
  output: number;  // $/1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Gemini
  'gemini-3.1-pro-preview':       { input: 3.00,   output: 15.00  }, // 🚫 사용 금지
  'gemini-3-flash-preview':       { input: 0.50,   output: 3.00   },
  'gemini-2.5-pro':               { input: 1.25,   output: 10.00  },
  'gemini-2.5-flash':             { input: 0.30,   output: 2.50   }, // ← 메인
  'gemini-2.5-flash-lite':        { input: 0.10,   output: 0.40   }, // ← fallback
  'gemini-3.1-flash-lite-preview':{ input: 0,      output: 0      }, // 무료

  // Claude
  'claude-opus-4-6':              { input: 5.00,   output: 25.00  },
  'claude-sonnet-4-6':            { input: 3.00,   output: 15.00  },
  'claude-sonnet-4-20250514':     { input: 3.00,   output: 15.00  },
  'claude-haiku-4.5':             { input: 1.00,   output: 5.00   },

  // OpenAI
  'gpt-5.4':                      { input: 2.50,   output: 15.00  },
  'gpt-5.4-mini':                 { input: 0.75,   output: 4.50   },
  'gpt-5.4-nano':                 { input: 0.20,   output: 1.25   },
  'gpt-5-mini':                   { input: 0.25,   output: 2.00   },
  'gpt-4o':                       { input: 2.50,   output: 10.00  },
  'gpt-4o-mini':                  { input: 0.15,   output: 0.60   },
  'o3':                           { input: 2.00,   output: 8.00   },
  'o4-mini':                      { input: 1.10,   output: 4.40   },
};

// ---------------------------------------------------------------------------
// Google Maps Platform 가격 (2026.04 기준, SKU별)
// 단위: $/건 (1000건당 가격 ÷ 1000)
// 참고: https://developers.google.com/maps/billing-and-pricing/pricing
// ---------------------------------------------------------------------------

export const GOOGLE_API_PRICING = {
  // Places API (New) — FieldMask에 따라 SKU 결정
  places: {
    textSearchEssentialsIdsOnly: { perCall: 0,       monthlyFree: Infinity, name: 'Text Search Essentials (IDs Only)' },
    textSearchEssentials:        { perCall: 0.005,   monthlyFree: 10_000,   name: 'Text Search Essentials' },
    textSearchPro:               { perCall: 0.032,   monthlyFree: 5_000,    name: 'Text Search Pro' },
    textSearchEnterprise:        { perCall: 0.035,   monthlyFree: 1_000,    name: 'Text Search Enterprise' },
    placeDetailsEssentials:      { perCall: 0.005,   monthlyFree: 10_000,   name: 'Place Details Essentials' },
    placeDetailsPro:             { perCall: 0.017,   monthlyFree: 5_000,    name: 'Place Details Pro' },
    placeDetailsPhotos:          { perCall: 0.007,   monthlyFree: 1_000,    name: 'Place Details Photos' },
  },
  // Routes API
  routes: {
    computeRoutesEssentials:     { perCall: 0.005,   monthlyFree: 10_000,   name: 'Compute Routes Essentials' },
    computeRoutesPro:            { perCall: 0.010,   monthlyFree: 5_000,    name: 'Compute Routes Pro' },
  },
  // Maps JS
  maps: {
    dynamicMaps:                 { perCall: 0.007,   monthlyFree: 10_000,   name: 'Dynamic Maps' },
  },
  // 무료 API
  free: {
    geoapify:                    { perCall: 0,       monthlyFree: Infinity, name: 'Geoapify Geocoding (3000/day)' },
    nominatim:                   { perCall: 0,       monthlyFree: Infinity, name: 'Nominatim (1req/sec)' },
    overpass:                    { perCall: 0,       monthlyFree: Infinity, name: 'Overpass API' },
    osrm:                        { perCall: 0,       monthlyFree: Infinity, name: 'OSRM Demo (프로덕션 금지)' },
  },
};

/** 모델 가격 조회 (없으면 기본값 반환) */
export function getModelPricing(modelName: string): ModelPricing {
  // 정확히 매칭
  if (MODEL_PRICING[modelName]) return MODEL_PRICING[modelName];

  // 부분 매칭 (gemini-2.5-flash-001 같은 버전 suffix 처리)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelName.startsWith(key)) return pricing;
  }

  // 기본값: 비싼 쪽으로 (과소추정 방지)
  return { input: 1.00, output: 5.00 };
}

/** 비용 추산 (토큰 수 기준) */
export function estimateCost(modelName: string, inputTokens: number, outputTokens: number): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
} {
  const pricing = getModelPricing(modelName);
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: 'USD',
  };
}
