import Anthropic from '@anthropic-ai/sdk';
import type { TripItem, TripAdvisories } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { AIProvider, AIGenerateResult, GenerateInput, AIGeneratedItem, PlacePreferenceInput, VerifiedPlace } from './types';
import { buildSystemPrompt, buildUserPrompt, buildSingleDayPrompt, buildMetadataPrompt } from './prompt';
import { getClaudeModel, getOpenAILightModel } from './models';
import { parseAIResponse, parseCombinedResponse, parseMetadataResponse } from './parseResponse';
import { resolveTimeOverlaps } from './itineraryValidation';
import { getDayCount } from '@/utils/date';
import { normalizePlaceName, isFuzzyDuplicate } from './utils/placeName';
import { toTripItems } from './utils/tripItemMapper';

/** 타임아웃 레이스 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms),
    ),
  ]);
}

/** Anthropic 클라이언트 지연 초기화 — AI_PROVIDER=openai일 때 모듈 로드 crash 방지 */
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
    _client = new Anthropic({
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      timeout: 120_000,
      maxRetries: 0, // 재시도는 직접 관리
    });
  }
  return _client;
}

/** Claude 스트리밍 호출 */
async function callClaudeStreaming(
  system: string,
  userContent: string,
  maxTokens: number,
): Promise<string> {
  const anthropic = getClient();
  const model = getClaudeModel();

  const stream = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userContent }],
    stream: true,
  });

  let content = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      content += event.delta.text;
    }
  }

  if (!content) throw new Error('Claude streaming returned empty');
  return content;
}

/** Claude 비스트리밍 호출 */
async function callClaudeNonStreaming(
  system: string,
  userContent: string,
  maxTokens: number,
): Promise<string> {
  const anthropic = getClient();
  const model = getClaudeModel();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude non-streaming returned empty');
  }
  return textBlock.text;
}

/** OpenAI nano 폴백 — Claude 완전 실패 시 GPT-5.4 nano로 폴백 */
async function callOpenAINanoFallback(
  system: string,
  userContent: string,
  maxTokens: number,
): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY unavailable for nano fallback');

  const openai = new OpenAI({
    apiKey: openaiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 60_000,
    maxRetries: 0,
  });

  const lightModel = getOpenAILightModel();
  const isGateway = !!process.env.OPENAI_BASE_URL;

  // nano는 non-reasoning → max_tokens + temperature
  const messages: Array<{ role: 'system' | 'user'; content: string }> = isGateway
    ? [{ role: 'user', content: `${system}\n\n---\n\n${userContent}` }]
    : [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ];

  const response = await openai.chat.completions.create({
    model: lightModel,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI nano returned empty');
  return content;
}

/**
 * Claude 3-layer 재시도:
 * 1. Claude 스트리밍 (85초 타임아웃)
 * 2. Claude 비스트리밍 (90초 타임아웃, 1초 대기)
 * 3. OpenAI nano 폴백 (55초 타임아웃)
 * 4. throw → ai.service.ts가 catch → mock 폴백
 */
async function callClaudeWithRetry(
  system: string,
  userContent: string,
  maxTokens: number,
): Promise<string> {
  // Layer 1: Claude 스트리밍
  try {
    const start = Date.now();
    const result = await withTimeout(
      callClaudeStreaming(system, userContent, maxTokens),
      85_000,
    );
    console.log(`[Claude] ✓ Layer1 스트리밍 성공 ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    console.warn(`[Claude] ✗ Layer1 스트리밍 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Layer 2: Claude 비스트리밍 (1초 대기 후)
  try {
    await new Promise(r => setTimeout(r, 1000));
    const start = Date.now();
    const result = await withTimeout(
      callClaudeNonStreaming(system, userContent, maxTokens),
      90_000,
    );
    console.log(`[Claude] ✓ Layer2 비스트리밍 성공 ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    console.warn(`[Claude] ✗ Layer2 비스트리밍 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Layer 3: OpenAI nano 폴백
  try {
    const start = Date.now();
    const result = await withTimeout(
      callOpenAINanoFallback(system, userContent, Math.min(maxTokens, 8000)),
      55_000,
    );
    console.log(`[Claude] ✓ Layer3 OpenAI nano 폴백 성공 ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  } catch (err) {
    console.warn(`[Claude] ✗ Layer3 nano 폴백 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error('Claude provider: 모든 레이어 실패 (streaming → non-streaming → nano)');
}

// toTripItems는 utils/tripItemMapper.ts에서 import (위 참조)

export const claudeProvider: AIProvider = {
  async generateItinerary(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
  ): Promise<AIGenerateResult> {
    const stamina = profile.lifestyle?.stamina || 'moderate';
    const dayCount = getDayCount(input.startDate, input.endDate);
    const systemPrompt = buildSystemPrompt('claude');

    // ≤4일: 전체 1회 호출 (combined response: tripSummary + advisories + items)
    if (dayCount <= 4) {
      const userPrompt = buildUserPrompt(profile, input, placePreferences, verifiedPlaces);
      const content = await callClaudeWithRetry(systemPrompt, userPrompt, 16000);
      const { items: rawItems, metadata } = parseCombinedResponse(content);
      return {
        items: toTripItems(rawItems, stamina),
        tripSummary: metadata?.tripSummary,
        advisories: metadata?.advisories,
      };
    }

    // ≥5일: 일 단위 청킹 (각 day는 items 배열만)
    const allItems: AIGeneratedItem[] = [];
    const previousPlaces: string[] = [];
    let failedDays = 0;

    for (let day = 1; day <= dayCount; day++) {
      // 첫째 날 이후 딜레이 (rate limit 회피)
      if (day > 1) {
        await new Promise(r => setTimeout(r, 1500));
      }

      const dayPrompt = buildSingleDayPrompt(
        profile, input, day, dayCount,
        previousPlaces, placePreferences, verifiedPlaces,
      );

      console.log(`[Claude] 일 단위 요청: Day ${day}/${dayCount}`);

      try {
        const content = await callClaudeWithRetry(systemPrompt, dayPrompt, 5000);
        const dayItems = parseAIResponse(content);
        allItems.push(...dayItems);
        for (const item of dayItems) {
          previousPlaces.push(item.placeNameSnapshot);
        }
      } catch (err) {
        console.warn(`[Claude] Day ${day} 최종 실패:`, err instanceof Error ? err.message : err);
        failedDays++;
      }
    }

    if (allItems.length === 0) {
      throw new Error(`Claude: ${dayCount}일 전체 실패`);
    }

    if (failedDays > 0) {
      console.warn(`[Claude] ${dayCount}일 중 ${failedDays}일 실패`);
    }

    // 중복 제거 (퍼지 매칭)
    const seenNormalized: string[] = [];
    const dedupedItems = allItems.filter((item) => {
      const normalized = normalizePlaceName(item.placeNameSnapshot);
      if (seenNormalized.some((seen) => isFuzzyDuplicate(seen, normalized))) return false;
      seenNormalized.push(normalized);
      return true;
    });

    // 시간순 정렬
    dedupedItems.sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.startTime.localeCompare(b.startTime);
    });

    // 시간 중복 제거
    const timeValidated = resolveTimeOverlaps(dedupedItems);

    // orderIndex 재할당
    const dayCounters: Record<number, number> = {};
    for (const item of timeValidated) {
      dayCounters[item.dayNumber] = dayCounters[item.dayNumber] ?? 0;
      item.orderIndex = dayCounters[item.dayNumber]++;
      if (item.orderIndex === 0) {
        item.transitMode = null;
        item.transitDurationMin = null;
        item.transitSummary = null;
      }
    }

    const items = toTripItems(timeValidated, stamina);

    // 메타데이터 별도 생성 (경량 호출, 실패 시 graceful degradation)
    let tripSummary: string | undefined;
    let advisories: TripAdvisories | undefined;
    try {
      const metadataPrompt = buildMetadataPrompt(
        input.destination, input.startDate, input.endDate, previousPlaces,
      );
      const metaContent = await callClaudeWithRetry(systemPrompt, metadataPrompt, 2000);
      const metadata = parseMetadataResponse(metaContent);
      if (metadata) {
        tripSummary = metadata.tripSummary;
        advisories = metadata.advisories;
      }
    } catch (err) {
      console.warn('[Claude] 메타데이터 생성 실패 (graceful skip):', err instanceof Error ? err.message : err);
    }

    return { items, tripSummary, advisories };
  },
};
