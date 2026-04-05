import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors/appError';
import { getRuntimeConfig } from './runtimeConfig';

/** 엔드포인트별 일일 한도 (free 기준) */
const ENDPOINT_LIMITS: Record<string, number> = {
  '/api/v1/ai/popular-places': 50,
  '/api/v1/ai/feasibility-check': 30,
  '/api/v1/weather': 20,
  '/api/v1/exchange': 20,
  '/api/v1/trips/checklist/write': 200,
  '/api/v1/rooms/messages/write': 500,
  '/api/v1/trips/photos/write': 50,
  '/api/v1/trips/optimize-route': 10,
  '/api/v1/trips/export': 30,
  '/api/v1/trips/history': 30,
};

/**
 * 요금제별 배수 — free 기준 한도에 곱해서 적용
 * AI 생성 한도 (기본 엔드포인트): free=10, pro=30, team=100
 */
const PLAN_MULTIPLIER: Record<string, number> = {
  free: 1,
  pro: 3,
  team: 10,
};

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<void> {
  const config = getRuntimeConfig();

  // 프로필 조회 (role + plan)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, plan')
    .eq('user_id', userId)
    .maybeSingle();

  // developer/admin은 rate limit 면제
  if (profile?.role === 'developer' || profile?.role === 'admin') {
    return;
  }

  const plan = profile?.plan || 'free';
  const multiplier = PLAN_MULTIPLIER[plan] ?? 1;

  // 런타임 설정의 일일 한도 (기본 엔드포인트용)
  const baseLimit = ENDPOINT_LIMITS[endpoint] ?? config.dailyLimitPerUser;
  const DAILY_LIMIT = Math.round(baseLimit * multiplier);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('api_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', todayStart.toISOString());

  if (error) throw error;

  if ((count ?? 0) >= DAILY_LIMIT) {
    const planLabel = plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : 'Team';
    throw new AppError(
      'RATE_LIMITED',
      `일일 한도(${planLabel}: ${DAILY_LIMIT}회)를 초과했습니다. ${plan === 'free' ? 'Pro로 업그레이드하면 3배 더 사용할 수 있습니다.' : '내일 다시 시도해주세요.'}`,
      429,
    );
  }
}

export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<void> {
  const { error } = await supabase
    .from('api_usage_log')
    .insert({ user_id: userId, endpoint });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 플랜별 AI 기능 차등 (v2 아키텍처)
// ---------------------------------------------------------------------------

export interface PlanFeatures {
  /** AI 모델명 (env fallback) */
  model: string;
  /** Google Places 장소 검증 활성화 */
  places: boolean;
  /** Google Directions 이동시간 활성화 */
  directions: boolean;
  /** 부분 재생성(repairDay) 최대 횟수/일 */
  repairs: number;
  /** 월간 일정 생성 한도 (-1=무제한) */
  monthlyLimit: number;
  /** 최대 여행일 (-1=무제한) */
  maxDays: number;
  /** 경로 최적화 (Greedy NN) */
  routeOptimize: boolean;
  /** 장소 사진 (Google Photos) */
  photos: boolean;
  /** 날씨 연동 */
  weather: boolean;
  /** PDF 내보내기 */
  exportPdf: boolean;
  /** ICS 캘린더 내보내기 */
  exportIcs: boolean;
}

// models.ts의 안전장치(3.1 Pro 차단 등)를 우회하지 않도록
// process.env 직접 참조 대신 models.ts의 함수를 사용
import { getGeminiMainModel, getGeminiLiteModel } from './ai/models';

export function getPlanFeatures(plan: string): PlanFeatures {
  const features: Record<string, PlanFeatures> = {
    free: {
      model: getGeminiLiteModel(),
      maxDays: 4,
      monthlyLimit: 3,
      places: false,
      directions: false,
      routeOptimize: false,
      photos: false,
      weather: false,
      exportPdf: false,
      exportIcs: false,
      repairs: 0,
    },
    pro: {
      model: getGeminiMainModel(),
      maxDays: -1,
      monthlyLimit: 20,
      places: true,
      directions: true,
      routeOptimize: true,
      photos: true,
      weather: true,
      exportPdf: true,
      exportIcs: true,
      repairs: 1,
    },
    team: {
      model: getGeminiMainModel(),
      maxDays: -1,
      monthlyLimit: -1,
      places: true,
      directions: true,
      routeOptimize: true,
      photos: true,
      weather: true,
      exportPdf: true,
      exportIcs: true,
      repairs: 2,
    },
  };
  return features[plan] || features.free;
}
