import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { getRuntimeConfig } from '@/lib/services/runtimeConfig';
import { getGeminiMainModel, getClaudeModel, getOpenAIModel } from '@/lib/services/ai/models';
import { getWeatherCacheStatus } from '@/lib/services/weather.service';
import { getExchangeCacheStatus } from '@/lib/services/exchange.service';
import { getPlacesCacheStatus } from '@/lib/services/ai/popularPlaces';

async function checkDevOrAdmin(supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'], userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'developer')) {
    throw new AppError('FORBIDDEN', '관리자 또는 개발자 권한이 필요합니다', 403);
  }
}

async function pingUrl(url: string, timeoutMs = 5000): Promise<{ reachable: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { reachable: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { reachable: false, latencyMs: Date.now() - start };
  }
}

/**
 * AI Provider 통신 상태 체크
 * 실제 생성 요청이 아닌 최소 요청으로 인증+연결만 확인 (비용 0 또는 극소)
 */
async function checkAIProviders(): Promise<Record<string, { reachable: boolean; latencyMs: number; keyConfigured: boolean; model: string; error: string | null }>> {
  const results: Record<string, { reachable: boolean; latencyMs: number; keyConfigured: boolean; model: string; error: string | null }> = {};

  // Gemini — models.list API (무료, 토큰 소비 없음)
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = getGeminiMainModel();
  const geminiKeyValid = geminiKey && !geminiKey.includes('여기') && !geminiKey.includes('입력') && geminiKey.length > 10;
  if (geminiKeyValid) {
    const start = Date.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { signal: AbortSignal.timeout(5000) },
      );
      results.gemini = {
        reachable: res.ok,
        latencyMs: Date.now() - start,
        keyConfigured: true,
        model: geminiModel,
        error: res.ok ? null : `HTTP ${res.status}`,
      };
    } catch (err) {
      results.gemini = { reachable: false, latencyMs: Date.now() - start, keyConfigured: true, model: geminiModel, error: err instanceof Error ? err.message : 'timeout' };
    }
  } else {
    results.gemini = { reachable: false, latencyMs: 0, keyConfigured: false, model: geminiModel, error: geminiKey ? 'GEMINI_API_KEY가 플레이스홀더 — 실제 키를 넣어주세요' : 'GEMINI_API_KEY 미설정' };
  }

  // Claude — 게이트웨이 경유 시 단순 연결 체크, 직접 연결 시 messages API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBase = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const claudeModel = getClaudeModel();
  const isGateway = !!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_BASE_URL.includes('anthropic.com');

  if (anthropicKey && anthropicKey !== 'dummy') {
    const start = Date.now();
    try {
      if (isGateway) {
        // 게이트웨이 경유: 단순 HEAD/GET으로 연결만 확인 (비용 0)
        const res = await fetch(anthropicBase, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        // 게이트웨이는 200, 404, 405 등 다양한 응답 가능 — 연결 자체가 되면 OK
        results.claude = {
          reachable: res.status < 500,
          latencyMs: Date.now() - start,
          keyConfigured: true,
          model: `${claudeModel} (via gateway)`,
          error: res.status >= 500 ? `Gateway HTTP ${res.status}` : null,
        };
      } else {
        // 직접 Anthropic API: messages로 ping (극소 비용)
        const res = await fetch(`${anthropicBase}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: claudeModel, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal: AbortSignal.timeout(10000),
        });
        results.claude = {
          reachable: res.status === 200 || res.status === 429,
          latencyMs: Date.now() - start,
          keyConfigured: true,
          model: claudeModel,
          error: res.status === 200 || res.status === 429 ? null : `HTTP ${res.status}`,
        };
      }
    } catch (err) {
      results.claude = {
        reachable: false,
        latencyMs: Date.now() - start,
        keyConfigured: true,
        model: isGateway ? `${claudeModel} (via gateway)` : claudeModel,
        error: err instanceof Error ? err.message : 'timeout',
      };
    }
  } else {
    results.claude = { reachable: false, latencyMs: 0, keyConfigured: false, model: claudeModel, error: 'ANTHROPIC_API_KEY 미설정' };
  }

  // OpenAI — 게이트웨이 경유 시 단순 연결, 직접 시 models 엔드포인트
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBase = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const openaiModel = getOpenAIModel();
  const isOpenaiGateway = !!process.env.OPENAI_BASE_URL && !process.env.OPENAI_BASE_URL.includes('openai.com');

  if (openaiKey && openaiKey !== 'dummy') {
    const start = Date.now();
    try {
      const pingUrl = isOpenaiGateway ? openaiBase : `${openaiBase}/models`;
      const res = await fetch(pingUrl, {
        headers: isOpenaiGateway ? {} : { 'Authorization': `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      results.openai = {
        reachable: isOpenaiGateway ? res.status < 500 : (res.ok || res.status === 429),
        latencyMs: Date.now() - start,
        keyConfigured: true,
        model: isOpenaiGateway ? `${openaiModel} (via gateway)` : openaiModel,
        error: (isOpenaiGateway ? res.status < 500 : (res.ok || res.status === 429)) ? null : `HTTP ${res.status}`,
      };
    } catch (err) {
      results.openai = { reachable: false, latencyMs: Date.now() - start, keyConfigured: true, model: isOpenaiGateway ? `${openaiModel} (via gateway)` : openaiModel, error: err instanceof Error ? err.message : 'timeout' };
    }
  } else {
    results.openai = { reachable: false, latencyMs: 0, keyConfigured: !!(openaiKey && openaiKey !== 'dummy'), model: openaiModel, error: 'OPENAI_API_KEY 미설정 또는 더미값' };
  }

  return results;
}

/** GET /api/v1/admin/health — 상세 헬스 (admin/developer만) */
export async function GET() {
  try {
    const { supabase, user } = await getAuthUser();
    await checkDevOrAdmin(supabase, user.id);

    const config = getRuntimeConfig();

    // DB 헬스 체크
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from('trips').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;

    // 외부 API + AI 헬스 (병렬)
    const [openMeteo, exchangeRate, googlePlaces, aiProviders] = await Promise.all([
      pingUrl('https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&daily=temperature_2m_max&forecast_days=1'),
      pingUrl('https://open.er-api.com/v6/latest/USD'),
      process.env.GOOGLE_PLACES_API_KEY
        ? pingUrl(`https://places.googleapis.com/v1/places:searchText`, 3000).then(r => ({ ...r, reachable: true })).catch(() => ({ reachable: false, latencyMs: 0 }))
        : Promise.resolve({ reachable: false, latencyMs: 0 }),
      checkAIProviders(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        database: { connected: !dbError, latencyMs: dbLatency, error: dbError?.message ?? null },
        externalAPIs: {
          openMeteo,
          exchangeRate,
          googlePlaces: { ...googlePlaces, keyConfigured: !!process.env.GOOGLE_PLACES_API_KEY },
        },
        aiProviders,
        caches: {
          weather: getWeatherCacheStatus(),
          exchange: getExchangeCacheStatus(),
          places: getPlacesCacheStatus(),
        },
        config: {
          aiEnabled: config.aiEnabled,
          aiProvider: config.aiProvider,
          dailyLimit: config.dailyLimitPerUser,
          features: config.features,
        },
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
