/**
 * Big Five 성격 점수 → 여행 행동 태그 변환.
 *
 * TIPI + 보완 문항(17문항)에서 산출된 Big Five 5개 도메인 점수(1~7)를
 * LLM이 바로 해석 가능한 행동 태그로 변환.
 *
 * LLM에게 숫자를 넘기지 않는 이유:
 * - "openness: 5.7"은 LLM에게 구체적 행동 지침이 아님 (MBTI와 같은 실패 반복)
 * - "novelty_seeking: high"는 "현지 가정식, 비주류 명소 우선"이라는 구체적 행동으로 연결됨
 *
 * moderate(3.0~4.9)는 기본값이므로 프롬프트에 포함하지 않음 → 토큰 절약.
 */

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** Big Five 5개 도메인 점수 (각 1~7, TIPI 7점 Likert) */
export interface Big5Scores {
  extraversion: number;       // 외향성
  agreeableness: number;      // 우호성
  conscientiousness: number;  // 성실성
  neuroticism: number;        // 부정적 정서성
  openness: number;           // 개방성
}

/** LLM에 전달되는 여행 행동 태그 (moderate면 생략) */
export interface PersonalityTags {
  /** 외향성 → 사교 에너지: 야시장/단체 vs 조용한 카페/자연 */
  social_energy?: 'high' | 'low';
  /** 개방성 → 새로움 추구: 로컬/비주류 vs 검증된 관광지 */
  novelty_seeking?: 'high' | 'low';
  /** 성실성 → 계획 스타일: 예약 필수/시간 버퍼 vs 즉흥/자유 여백 */
  planning_style?: 'structured' | 'spontaneous';
  /** 우호성 → 동행 조화: 모두가 즐기는 곳 vs 개인 취향 우선 */
  group_harmony?: 'high' | 'low';
  /** 부정적 정서성 → 안정 욕구: 안전 지역/버퍼 vs 로컬 탐험/빡빡 일정 */
  comfort_need?: 'high' | 'low';
}

// ---------------------------------------------------------------------------
// 임계값 — moderate 범위를 벗어나야 태그가 생성됨
// ---------------------------------------------------------------------------

const HIGH_THRESHOLD = 5.0;
const LOW_THRESHOLD = 3.0;

// ---------------------------------------------------------------------------
// 변환 로직
// ---------------------------------------------------------------------------

/**
 * Big Five 점수 → 여행 행동 태그 변환.
 * moderate 범위(3.0~4.9)는 태그를 생성하지 않음 → 프롬프트에 포함 안 됨.
 * 결과적으로 대부분의 유저는 0~3개 태그만 가짐.
 */
export function mapBig5ToTravelTags(scores: Big5Scores): PersonalityTags {
  const tags: PersonalityTags = {};

  // 외향성 → social_energy
  if (scores.extraversion >= HIGH_THRESHOLD) {
    tags.social_energy = 'high';
  } else if (scores.extraversion < LOW_THRESHOLD) {
    tags.social_energy = 'low';
  }

  // 개방성 → novelty_seeking
  if (scores.openness >= HIGH_THRESHOLD) {
    tags.novelty_seeking = 'high';
  } else if (scores.openness < LOW_THRESHOLD) {
    tags.novelty_seeking = 'low';
  }

  // 성실성 → planning_style
  if (scores.conscientiousness >= HIGH_THRESHOLD) {
    tags.planning_style = 'structured';
  } else if (scores.conscientiousness < LOW_THRESHOLD) {
    tags.planning_style = 'spontaneous';
  }

  // 우호성 → group_harmony
  if (scores.agreeableness >= HIGH_THRESHOLD) {
    tags.group_harmony = 'high';
  } else if (scores.agreeableness < LOW_THRESHOLD) {
    tags.group_harmony = 'low';
  }

  // 부정적 정서성 → comfort_need (높을수록 안정 필요)
  if (scores.neuroticism >= HIGH_THRESHOLD) {
    tags.comfort_need = 'high';
  } else if (scores.neuroticism < LOW_THRESHOLD) {
    tags.comfort_need = 'low';
  }

  return tags;
}

/**
 * PersonalityTags에서 moderate(빈 값)를 제거한 compact 객체 반환.
 * 빈 객체면 null 반환 → 프롬프트에 personality 블록 자체를 생략.
 */
export function getCompactPersonality(tags: PersonalityTags): PersonalityTags | null {
  const entries = Object.entries(tags).filter(([, v]) => v != null);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as PersonalityTags;
}

// ---------------------------------------------------------------------------
// TIPI 채점 유틸리티
// ---------------------------------------------------------------------------

/**
 * TIPI 17문항 응답(각 1~7)에서 Big Five 5개 도메인 점수를 계산.
 *
 * 문항 매핑 (1-indexed):
 *   외향성: #1, #6(R), #14
 *   우호성: #2(R), #7, #11, #17
 *   성실성: #3, #8(R), #15
 *   부정적 정서성: #4(R), #9, #16(R)
 *   개방성: #5, #10(R), #12, #13
 *
 * R = 역채점 (8 - score)
 */
export function scoreTIPI(responses: number[]): Big5Scores {
  if (responses.length !== 17) {
    throw new Error(`TIPI expects 17 responses, got ${responses.length}`);
  }

  const r = (i: number) => responses[i - 1]; // 1-indexed
  const rev = (i: number) => 8 - r(i);       // 역채점

  return {
    extraversion: avg(r(1), rev(6), r(14)),
    agreeableness: avg(rev(2), r(7), r(11), r(17)),
    conscientiousness: avg(r(3), rev(8), r(15)),
    neuroticism: avg(rev(4), r(9), rev(16)),
    openness: avg(r(5), rev(10), r(12), r(13)),
  };
}

function avg(...nums: number[]): number {
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10; // 소수점 1자리
}
