/**
 * 논문용 실험 테스트 스크립트
 * 동일 조건(오사카 3박4일)에서 프로필만 변경하여 AI 일정 생성 비교
 *
 * 측정 지표:
 * 1. Jaccard Distance — 두 장소 집합의 비유사도 (0=동일, 1=완전 상이)
 * 2. 카테고리 분포 비교 — 카이제곱 통계량 + Jensen-Shannon Divergence
 * 3. 시간대 활용 패턴 — 첫 일정 시작/마지막 종료 시각 비교
 * 4. 활동 강도 분포 — light/moderate/intense 비율
 *
 * 실행: npx tsx scripts/thesis-test.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

import { buildSystemPrompt, buildUserPrompt } from '../src/lib/services/ai/prompt';
import { parseAIResponse } from '../src/lib/services/ai/parseResponse';
import type { FullProfileInput } from '../src/lib/validators/profile';
import type { GenerateInput, AIGeneratedItem } from '../src/lib/services/ai/types';

// ======================================================================
// 공통 여행 조건 (통제 변수)
// ======================================================================
const tripInput: GenerateInput = {
  destination: '오사카',
  startDate: '2026-04-10',
  endDate: '2026-04-13', // 3박4일
};

// ======================================================================
// 프로필 정의 (독립 변수)
// ======================================================================

// 프로필 1: 자연/힐링/여유형
const profileNature: FullProfileInput = {
  mbtiStyle: 'INFP',
  lifestyle: {
    morningType: 'late',
    stamina: 'low',
    adventureLevel: 'cautious',
    photoStyle: 'casual',
  },
  foodPreference: [],
  interests: ['nature', 'hot-spring', 'temple', 'shrine'],
  customFoodPreference: '',
  customInterests: '조용한 정원, 힐링 산책',
  travelPace: 'relaxed',
  budgetRange: 'moderate',
  companion: 'couple',
  specialNote: '여유롭게 쉬면서 힐링하는 여행을 원합니다. 자연과 전통 문화를 즐기고 싶어요.',
  arrivalTime: 'morning',
  hotelArea: '난바',
};

// 프로필 2: 먹방/활동형
const profileFoodie: FullProfileInput = {
  mbtiStyle: 'ESTP',
  lifestyle: {
    morningType: 'early',
    stamina: 'high',
    adventureLevel: 'explorer',
    photoStyle: 'sns',
  },
  foodPreference: [],
  interests: ['local-food', 'street-food', 'shopping-vintage', 'nightlife'],
  customFoodPreference: '',
  customInterests: '현지인 맛집, B급 구르메, 먹방 투어',
  travelPace: 'active',
  budgetRange: 'moderate',
  companion: 'friends',
  specialNote: '오사카 먹방 투어! 타코야키, 오코노미야키, 쿠시카츠 등 현지 음식을 최대한 많이 먹고 싶어요. 활동적으로 돌아다니며 숨은 맛집을 찾고 싶습니다.',
  arrivalTime: 'morning',
  hotelArea: '난바',
};

// ======================================================================
// AI 호출
// ======================================================================

async function callAI(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const isGateway = !!baseURL;

  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
    timeout: 120_000,
  });

  console.log(`  [AI] Model: ${model}, Gateway: ${isGateway}`);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = isGateway
    ? [{ role: 'user', content: `${system}\n\n---\n\n${userPrompt}` }]
    : [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ];

  const isReasoning = /^(o1|o3|gpt-5)/i.test(model) && !/nano/i.test(model);

  const params: Record<string, unknown> = { model, messages };
  if (isReasoning) {
    params.max_completion_tokens = 16000;
  } else {
    params.max_tokens = 16000;
    params.temperature = 0.7;
  }

  const response = await client.chat.completions.create(
    params as unknown as Parameters<typeof client.chat.completions.create>[0],
  );
  const content = (response as unknown as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return content;
}

// ======================================================================
// 통계 함수
// ======================================================================

/** 장소명 정규화 — 괄호 안 외국어 제거, 공백/특수문자 제거 */
function normalizeName(name: string): string {
  return name
    .replace(/\s*[\(（].*?[\)）]\s*/g, '')
    .replace(/[\s\-·・]/g, '')
    .toLowerCase();
}

/** Jaccard Distance: 1 - |A∩B| / |A∪B| (0=동일, 1=완전 상이) */
function jaccardDistance(setA: Set<string>, setB: Set<string>): number {
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return 1 - intersection / union;
}

/** 카테고리 분포를 확률 벡터로 변환 */
function toDistribution(items: AIGeneratedItem[], categories: string[]): number[] {
  const counts: Record<string, number> = {};
  for (const cat of categories) counts[cat] = 0;
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  const total = items.length;
  return categories.map((cat) => (counts[cat] || 0) / total);
}

/** Jensen-Shannon Divergence (0=동일 분포, 1=완전 상이) */
function jensenShannonDivergence(p: number[], q: number[]): number {
  const m = p.map((pi, i) => (pi + q[i]) / 2);

  function klDiv(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] > 0 && b[i] > 0) {
        sum += a[i] * Math.log2(a[i] / b[i]);
      }
    }
    return sum;
  }

  return (klDiv(p, m) + klDiv(q, m)) / 2;
}

/** 시간을 분 단위로 변환 "HH:MM" → 분 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 활동 강도 분포 */
function activityDistribution(items: AIGeneratedItem[]): Record<string, number> {
  const counts: Record<string, number> = { light: 0, moderate: 0, intense: 0 };
  for (const item of items) {
    const level = item.activityLevel || 'moderate';
    counts[level] = (counts[level] || 0) + 1;
  }
  const total = items.length;
  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)]),
  );
}

/** 일별 시간대 패턴 분석 */
function timePatternAnalysis(items: AIGeneratedItem[], dayCount: number) {
  const byDay: Record<number, AIGeneratedItem[]> = {};
  for (const item of items) {
    if (!byDay[item.dayNumber]) byDay[item.dayNumber] = [];
    byDay[item.dayNumber].push(item);
  }

  let totalStartMin = 0;
  let totalEndMin = 0;
  let totalActiveHours = 0;
  let days = 0;

  for (let d = 1; d <= dayCount; d++) {
    const dayItems = byDay[d];
    if (!dayItems || dayItems.length === 0) continue;
    const sorted = dayItems.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const firstStart = timeToMinutes(sorted[0].startTime);
    const lastEnd = timeToMinutes(sorted[sorted.length - 1].endTime);
    totalStartMin += firstStart;
    totalEndMin += lastEnd;
    totalActiveHours += (lastEnd - firstStart) / 60;
    days++;
  }

  return {
    avgStartTime: formatMinutes(Math.round(totalStartMin / days)),
    avgEndTime: formatMinutes(Math.round(totalEndMin / days)),
    avgActiveHours: (totalActiveHours / days).toFixed(1),
    itemsPerDay: (items.length / dayCount).toFixed(1),
  };
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ======================================================================
// 테스트 실행
// ======================================================================

async function runTest(label: string, profile: FullProfileInput) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`테스트: ${label}`);
  console.log(`${'='.repeat(60)}`);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(profile, tripInput);

  console.log(`  프롬프트 길이: system=${systemPrompt.length}자, user=${userPrompt.length}자`);
  console.log(`  호출 시작...`);

  const start = Date.now();
  const content = await callAI(systemPrompt, userPrompt);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  응답 완료 (${elapsed}s, ${content.length}자)`);

  const items = parseAIResponse(content);
  console.log(`  파싱된 항목: ${items.length}개`);

  // Day별 정리 출력
  const byDay: Record<number, AIGeneratedItem[]> = {};
  for (const item of items) {
    if (!byDay[item.dayNumber]) byDay[item.dayNumber] = [];
    byDay[item.dayNumber].push(item);
  }

  console.log(`\n[${label}]`);
  for (const [day, dayItems] of Object.entries(byDay).sort(([a], [b]) => Number(a) - Number(b))) {
    const sorted = dayItems.sort((a, b) => a.orderIndex - b.orderIndex);
    const places = sorted.map(
      (i) => `${i.placeNameSnapshot} (${i.category}, ${i.startTime}-${i.endTime})`,
    );
    console.log(`Day${day}: ${places.join(' → ')}`);
  }

  // 카테고리 통계
  const catCount: Record<string, number> = {};
  for (const item of items) {
    catCount[item.category] = (catCount[item.category] || 0) + 1;
  }
  console.log(`\n카테고리 분포:`, catCount);

  // reasonTags 통계
  const tagCount: Record<string, number> = {};
  for (const item of items) {
    for (const tag of item.reasonTags || []) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  console.log(
    `Top 태그:`,
    topTags.map(([t, c]) => `${t}(${c})`).join(', '),
  );

  return { items, byDay };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    Tripplan 개인화 검증 실험 — 논문용 정량 분석        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n목적지: ${tripInput.destination}`);
  console.log(`기간: ${tripInput.startDate} ~ ${tripInput.endDate} (3박4일)`);
  console.log(`AI 모델: ${process.env.OPENAI_MODEL || 'gpt-5.4-mini'}`);
  console.log(`게이트웨이: ${process.env.OPENAI_BASE_URL || 'direct'}`);

  try {
    // 1회차
    const result1 = await runTest('Tripplan 1회차: 자연/힐링', profileNature);
    await new Promise((r) => setTimeout(r, 3000));
    // 2회차
    const result2 = await runTest('Tripplan 2회차: 먹방/활동형', profileFoodie);

    // ==================================================================
    // 정량 분석
    // ==================================================================
    console.log(`\n${'═'.repeat(60)}`);
    console.log('정량 분석 결과 (Quantitative Analysis)');
    console.log(`${'═'.repeat(60)}`);

    const items1 = result1.items;
    const items2 = result2.items;

    // --- 지표 1: Jaccard Distance (장소 집합 비유사도) ---
    // 정규화된 장소명으로 비교 (괄호 안 외국어, 공백 제거)
    const normSet1 = new Set(items1.map((i) => normalizeName(i.placeNameSnapshot)));
    const normSet2 = new Set(items2.map((i) => normalizeName(i.placeNameSnapshot)));
    const jd = jaccardDistance(normSet1, normSet2);

    // 중복 장소 식별 (원본 이름으로 출력)
    const nameMap1: Record<string, string> = {};
    for (const i of items1) nameMap1[normalizeName(i.placeNameSnapshot)] = i.placeNameSnapshot;
    const overlapNorm = [...normSet1].filter((x) => normSet2.has(x));
    const overlapNames = overlapNorm.map((n) => nameMap1[n] || n);

    console.log(`\n── 지표 1: Jaccard Distance (장소 집합 비유사도) ──`);
    console.log(`  1회차 고유 장소: ${normSet1.size}개`);
    console.log(`  2회차 고유 장소: ${normSet2.size}개`);
    console.log(`  합집합: ${new Set([...normSet1, ...normSet2]).size}개`);
    console.log(`  교집합 (중복): ${overlapNorm.length}개 → ${overlapNames.join(', ') || '없음'}`);
    console.log(`  Jaccard Distance: ${jd.toFixed(4)} (0=동일, 1=완전 상이)`);
    console.log(`  → 해석: 두 일정의 장소가 ${(jd * 100).toFixed(1)}% 상이`);

    // --- 지표 2: 카테고리 분포 비교 (JSD) ---
    const allCategories = [
      'attraction',
      'restaurant',
      'cafe',
      'shopping',
      'transport',
      'hotel',
    ];
    const dist1 = toDistribution(items1, allCategories);
    const dist2 = toDistribution(items2, allCategories);
    const jsd = jensenShannonDivergence(dist1, dist2);

    console.log(`\n── 지표 2: 카테고리 분포 비교 ──`);
    console.log(`  카테고리       | 1회차(힐링) | 2회차(먹방) | 차이`);
    console.log(`  ─────────────┼─────────────┼─────────────┼──────`);
    for (let i = 0; i < allCategories.length; i++) {
      const cat = allCategories[i].padEnd(13);
      const v1 = `${(dist1[i] * 100).toFixed(1)}%`.padStart(10);
      const v2 = `${(dist2[i] * 100).toFixed(1)}%`.padStart(10);
      const diff = `${((dist2[i] - dist1[i]) * 100).toFixed(1)}%p`.padStart(8);
      console.log(`  ${cat} | ${v1}  | ${v2}  | ${diff}`);
    }
    console.log(`  Jensen-Shannon Divergence: ${jsd.toFixed(4)} (0=동일, 1=완전 상이)`);
    console.log(`  → 해석: 카테고리 배분 패턴이 ${(jsd * 100).toFixed(1)}% 상이`);

    // --- 지표 3: 시간대 활용 패턴 ---
    const time1 = timePatternAnalysis(items1, 4);
    const time2 = timePatternAnalysis(items2, 4);

    console.log(`\n── 지표 3: 시간대 활용 패턴 ──`);
    console.log(`  지표           | 1회차(힐링) | 2회차(먹방) | 차이`);
    console.log(`  ─────────────┼─────────────┼─────────────┼──────`);
    console.log(
      `  평균 시작시각  | ${time1.avgStartTime.padStart(10)}  | ${time2.avgStartTime.padStart(10)}  |`,
    );
    console.log(
      `  평균 종료시각  | ${time1.avgEndTime.padStart(10)}  | ${time2.avgEndTime.padStart(10)}  |`,
    );
    console.log(
      `  평균 활동시간  | ${(time1.avgActiveHours + '시간').padStart(10)}  | ${(time2.avgActiveHours + '시간').padStart(10)}  |`,
    );
    console.log(
      `  일평균 장소수  | ${(time1.itemsPerDay + '개').padStart(10)}  | ${(time2.itemsPerDay + '개').padStart(10)}  |`,
    );

    // --- 지표 4: 활동 강도 분포 ---
    const activity1 = activityDistribution(items1);
    const activity2 = activityDistribution(items2);

    console.log(`\n── 지표 4: 활동 강도 분포 ──`);
    console.log(`  강도         | 1회차(힐링) | 2회차(먹방)`);
    console.log(`  ───────────┼─────────────┼────────────`);
    for (const level of ['light', 'moderate', 'intense'] as const) {
      console.log(
        `  ${level.padEnd(11)} | ${String(activity1[level] || 0).padStart(9)}%  | ${String(activity2[level] || 0).padStart(9)}%`,
      );
    }

    // --- 지표 5: reasonTags 겹침 분석 ---
    const tags1 = new Set(items1.flatMap((i) => i.reasonTags || []));
    const tags2 = new Set(items2.flatMap((i) => i.reasonTags || []));
    const tagJd = jaccardDistance(tags1, tags2);

    console.log(`\n── 지표 5: 추천 태그 Jaccard Distance ──`);
    console.log(`  1회차 고유 태그: ${tags1.size}개`);
    console.log(`  2회차 고유 태그: ${tags2.size}개`);
    console.log(`  태그 Jaccard Distance: ${tagJd.toFixed(4)}`);

    // ==================================================================
    // 종합 요약
    // ==================================================================
    console.log(`\n${'═'.repeat(60)}`);
    console.log('종합 요약 (Summary for Paper)');
    console.log(`${'═'.repeat(60)}`);
    console.log(`
┌────────────────────────────────────┬──────────┬─────────────────────┐
│ 지표                                │ 수치      │ 해석                 │
├────────────────────────────────────┼──────────┼─────────────────────┤
│ Jaccard Distance (장소)             │ ${jd.toFixed(4).padStart(8)} │ 장소 ${(jd * 100).toFixed(0)}% 상이           │
│ Jensen-Shannon Div. (카테고리)      │ ${jsd.toFixed(4).padStart(8)} │ 카테고리 배분 ${(jsd * 100).toFixed(0)}% 상이  │
│ Jaccard Distance (태그)             │ ${tagJd.toFixed(4).padStart(8)} │ 추천 근거 ${(tagJd * 100).toFixed(0)}% 상이    │
│ 일평균 장소 수 차이                  │ ${Math.abs(Number(time1.itemsPerDay) - Number(time2.itemsPerDay)).toFixed(1).padStart(8)} │ 활동형이 더 많은 장소 │
│ 활동시간 차이                        │ ${Math.abs(Number(time1.avgActiveHours) - Number(time2.avgActiveHours)).toFixed(1).padStart(6)}hr │ 활동형이 더 긴 일정   │
└────────────────────────────────────┴──────────┴─────────────────────┘

대조군 참고: 트리플에서 동일 조건(프로필 변경)으로 테스트 시
모든 지표가 0에 수렴해야 함 (프로필 무관하게 동일 일정 생성).
`);
  } catch (err) {
    console.error('테스트 실패:', err);
    process.exit(1);
  }
}

main();
