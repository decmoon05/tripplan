/**
 * Runtime Config — 서버 재시작 없이 설정 변경
 *
 * 인메모리 저장. 서버리스 환경에서는 인스턴스마다 독립.
 * 서버 재시작 시 .env 기본값으로 초기화.
 */

export interface RuntimeConfig {
  // AI 제어
  aiProvider: 'gemini' | 'claude' | 'openai' | 'mock';
  pipelineVersion: 'v2' | 'v3';
  aiEnabled: boolean;
  dailyLimitPerUser: number;
  monthlySpendCapUSD: number;

  // 기능 on/off
  features: {
    weather: boolean;
    exchange: boolean;
    googlePlaces: boolean;
    popularPlaces: boolean;
    feasibilityCheck: boolean;
    postValidation: boolean;
  };
}

// .env에서 초기값 로드
function loadDefaults(): RuntimeConfig {
  return {
    aiProvider: (process.env.AI_PROVIDER || 'mock') as RuntimeConfig['aiProvider'],
    pipelineVersion: (process.env.PIPELINE_VERSION || 'v3') as 'v2' | 'v3',
    aiEnabled: true,
    dailyLimitPerUser: Number(process.env.AI_DAILY_LIMIT) || 10,
    monthlySpendCapUSD: 100, // 기본 $100/월

    features: {
      weather: true,
      exchange: true,
      googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
      popularPlaces: !!process.env.GOOGLE_PLACES_API_KEY,
      feasibilityCheck: true,
      postValidation: !!process.env.GOOGLE_PLACES_API_KEY,
    },
  };
}

let config: RuntimeConfig = loadDefaults();

/** 현재 런타임 설정 조회 */
export function getRuntimeConfig(): Readonly<RuntimeConfig> {
  return config;
}

/** 런타임 설정 부분 업데이트 */
export function updateRuntimeConfig(partial: Partial<RuntimeConfig>): RuntimeConfig {
  // features는 deep merge
  if (partial.features) {
    config = {
      ...config,
      ...partial,
      features: { ...config.features, ...partial.features },
    };
  } else {
    config = { ...config, ...partial };
  }
  return config;
}

/** 기본값으로 초기화 */
export function resetRuntimeConfig(): RuntimeConfig {
  config = loadDefaults();
  return config;
}
