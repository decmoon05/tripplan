/**
 * AI Debug Log — 개발자/관리자용 AI 호출 추적
 *
 * 서버 메모리에 최근 N개 AI 호출 기록을 보관.
 * /api/v1/admin/ai-logs API로 조회 가능 (admin/developer만).
 *
 * 프로덕션에서는 외부 DB(api_usage_log)에 저장할 수도 있지만,
 * 현재는 서버 메모리로 충분 (서버리스 재시작 시 초기화 허용).
 */

export interface AIDebugEntry {
  id: string;
  timestamp: string;
  provider: string;       // 'gemini' | 'claude' | 'openai' | 'mock'
  model: string;          // 실제 모델명
  endpoint: string;       // 'generate' | 'feasibility' | 'popular-places'
  userId: string;
  destination: string;

  // 프롬프트
  systemPromptLength: number;  // 문자 수 (전문은 너무 길어 저장 안 함)
  userPromptPreview: string;   // 첫 500자
  userPromptLength: number;

  // 토큰 & 비용
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUSD: number | null;

  // 결과
  durationMs: number;
  success: boolean;
  error: string | null;
  itemCount: number | null;    // 생성된 아이템 수 (generate 시)
}

// ── 인메모리 로그 (최대 100개) ──
const MAX_ENTRIES = 100;
const entries: AIDebugEntry[] = [];

export function logAICall(entry: AIDebugEntry): void {
  entries.unshift(entry); // 최신 순
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }
}

export function getAILogs(limit = 50): AIDebugEntry[] {
  return entries.slice(0, limit);
}

export function clearAILogs(): void {
  entries.length = 0;
}

// ── 비용 추정 — models.ts 중앙 가격표 사용 ──
import { estimateCost as estimateCostFromModels } from './models';

export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const result = estimateCostFromModels(model, inputTokens, outputTokens);
  return Math.round(result.totalCost * 10000) / 10000;
}

/** 유니크 ID 생성 */
export function debugId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
