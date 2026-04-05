import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/services/ai/prompt';
import { generateRequestSchema } from '@/lib/validators/aiGenerate';
import { getRuntimeConfig } from '@/lib/services/runtimeConfig';
import { getCurrentModelName, getModelPricing, estimateCost } from '@/lib/services/ai/models';

/**
 * POST /api/v1/ai/estimate
 * 실제 프롬프트를 조립하고 Gemini countTokens API로 정확한 토큰 수 계산.
 * 비용 0, 3000 RPM 한도.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthUser();

    // admin/developer만 허용
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profileData || (profileData.role !== 'admin' && profileData.role !== 'developer')) {
      throw new AppError('FORBIDDEN', '관리자 또는 개발자 권한이 필요합니다', 403);
    }

    const body = await request.json();
    const { profile, tripInput, placePreferences } = generateRequestSchema.parse(body);

    const config = getRuntimeConfig();
    const model = getCurrentModelName();

    // 실제 프롬프트 조립 (AI 생성 때와 동일한 함수 사용)
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      profile,
      { destination: tripInput.destination, startDate: tripInput.startDate, endDate: tripInput.endDate },
      placePreferences,
    );

    const systemLength = systemPrompt.length;
    const userLength = userPrompt.length;

    // Provider별 정확한 토큰 카운트 (전부 무료)
    let inputTokens: number | null = null;
    let estimatedOutputTokens: number | null = null;
    let countMethod = 'estimated';

    if (config.aiProvider === 'gemini') {
      // Gemini countTokens API (무료, 3000 RPM)
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const result = await ai.models.countTokens({
            model,
            contents: `${systemPrompt}\n\n---\n\n${userPrompt}`,
          });
          inputTokens = result.totalTokens ?? null;
          countMethod = 'exact (Gemini countTokens)';
        } catch (err) {
          console.warn('[Estimate] Gemini countTokens 실패:', err instanceof Error ? err.message : err);
        }
      }
    } else if (config.aiProvider === 'claude') {
      // Claude /v1/messages/count_tokens API (무료)
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const anthropicBase = process.env.ANTHROPIC_BASE_URL;
      if (anthropicKey && anthropicKey !== 'dummy') {
        try {
          const client = new Anthropic({
            apiKey: anthropicKey,
            baseURL: anthropicBase || undefined,
            timeout: 10_000,
          });
          const result = await client.messages.countTokens({
            model,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          });
          inputTokens = result.input_tokens ?? null;
          countMethod = 'exact (Claude countTokens)';
        } catch (err) {
          console.warn('[Estimate] Claude countTokens 실패:', err instanceof Error ? err.message : err);
        }
      }
    }
    // OpenAI — tiktoken 패키지 없이는 정확한 카운트 불가, 문자 수 추정

    // 정확한 카운트 실패 시 문자 수 기반 추정
    if (inputTokens === null) {
      const totalChars = systemLength + userLength;
      // 한/영 혼합 텍스트: Gemini/Claude ~3.5 chars/token, OpenAI ~3 chars/token
      const charsPerToken = config.aiProvider === 'openai' ? 3 : 3.5;
      inputTokens = Math.round(totalChars / charsPerToken);
      countMethod = `estimated (${totalChars}자 ÷ ${charsPerToken} chars/token)`;
    }

    // 출력 토큰 추정: 일수 × 아이템 수 × 아이템당 평균 토큰
    const dayCount = Math.max(1, Math.ceil(
      (new Date(tripInput.endDate).getTime() - new Date(tripInput.startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1);
    const itemsPerDay = profile.travelPace === 'active' ? 6 : profile.travelPace === 'relaxed' ? 4 : 5;
    // Gemini JSON 출력: 아이템당 ~150 토큰 (모든 필드 포함)
    estimatedOutputTokens = dayCount * itemsPerDay * 150 + 500; // +500 for tripSummary + advisories

    const totalTokens = inputTokens + estimatedOutputTokens;

    // 비용 계산 (models.ts 중앙 가격표 사용)
    const costResult = estimateCost(model, inputTokens, estimatedOutputTokens);
    const totalCost = Math.round(costResult.totalCost * 10000) / 10000;

    return NextResponse.json({
      success: true,
      data: {
        model,
        provider: config.aiProvider,
        countMethod, // 'exact' (countTokens) 또는 'estimated' (문자 수 기반)

        // 프롬프트 상세
        systemPromptLength: systemLength,
        userPromptLength: userLength,
        systemPromptPreview: systemPrompt.slice(0, 300) + '...',
        userPromptPreview: userPrompt.slice(0, 500) + '...',

        // 토큰
        inputTokens,
        estimatedOutputTokens,
        totalTokens,

        // 비용
        pricing: getModelPricing(model),
        estimatedCostUSD: totalCost,

        // 컨텍스트
        dayCount,
        itemsPerDay,
      },
      error: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
