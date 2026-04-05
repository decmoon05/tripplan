/**
 * 프로필 데이터 처리 공유 유틸리티.
 * prompt.ts(v2)와 promptV3.ts(v3) 양쪽에서 사용.
 */

import type { FullProfileInput } from '@/lib/validators/profile';
import type { Big5Scores } from './personalityMapper';

/** 입력 새니타이즈 — 제어문자 + 따옴표 제거 + 길이 제한 */
export const sanitize = (s: string, max = 200) => s.replace(/[\x00-\x1f"""]/g, '').slice(0, max);

/** specialNote에서 렌터카 키워드 감지 */
export function detectRentalCar(profile: FullProfileInput): boolean {
  const text = `${profile.specialNote || ''} ${profile.customInterests || ''}`.toLowerCase();
  return /렌터카|렌트카|rental\s*car|자차|자가용|drive|드라이브/.test(text);
}

/**
 * Big Five 점수 추출 (nested/flat 양쪽 지원).
 * - nested: profile.big5 = { extraversion, ... } (validator 경유)
 * - flat: profile.big5Extraversion, ... (DB 경유)
 */
export function extractBig5(profile: FullProfileInput): Big5Scores | null {
  // 1. nested 형태
  const nested = (profile as Record<string, unknown>).big5;
  if (nested && typeof nested === 'object') {
    const b = nested as Record<string, unknown>;
    if (typeof b.extraversion === 'number') {
      return b as unknown as Big5Scores;
    }
  }

  // 2. flat 형태 (DB에서 로드)
  const flat = profile as unknown as Record<string, unknown>;
  const e = flat.big5Extraversion;
  const a = flat.big5Agreeableness;
  const c = flat.big5Conscientiousness;
  const n = flat.big5Neuroticism;
  const o = flat.big5Openness;
  if (typeof e === 'number' && typeof a === 'number' && typeof c === 'number' &&
      typeof n === 'number' && typeof o === 'number') {
    return { extraversion: e, agreeableness: a, conscientiousness: c, neuroticism: n, openness: o };
  }

  return null;
}
