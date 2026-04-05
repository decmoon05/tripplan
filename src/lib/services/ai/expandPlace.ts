import OpenAI from 'openai';
import { z } from 'zod/v4';
import { isGatewayMode, isReasoningModel } from './prompt';

const expandedSubItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  estimatedCost: z.number(),
  currency: z.string(),
  category: z.string(),
  selectable: z.boolean().optional(),
  group: z.string().nullable().optional(),
});

const expandedSubItemsSchema = z.array(expandedSubItemSchema);

/** OpenAI 클라이언트 지연 초기화 — AI_PROVIDER=claude일 때 불필요한 인스턴스화 방지 */
let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      timeout: 120_000,
      maxRetries: 0,
    });
  }
  return _openaiClient;
}

/** 타임아웃 레이스 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms),
    ),
  ]);
}

/** 스트리밍 호출 (reasoning 모델 자동 분기) */
async function callStreaming(
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxTokens: number,
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<string> {
  const isReasoning = isReasoningModel(model);

  const stream = await getOpenAIClient().chat.completions.create({
    model,
    messages,
    stream: true,
    ...(isReasoning
      ? {
          max_completion_tokens: maxTokens,
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        }
      : { max_tokens: maxTokens, temperature: 0.7 }),
  });

  let content = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) content += delta;
  }
  if (!content) throw new Error('Streaming returned empty');
  return content;
}

export interface ExpandedSubItem {
  name: string;
  description: string;
  estimatedCost: number;
  currency: string;
  category: string;
  selectable?: boolean;  // 사용자가 선택 가능한 옵션인지
  group?: string;        // 같은 그룹이면 택1 (예: 객실 타입)
}

export async function expandPlace(
  placeName: string,
  category: string,
  destination: string,
): Promise<ExpandedSubItem[]> {
  const providerType = process.env.AI_PROVIDER || 'mock';

  if (providerType === 'mock') {
    return getMockExpanded(placeName, category, destination);
  }

  try {
    const categoryGuide: Record<string, string> = {
      restaurant: '인기 메뉴 3~5개 (실제 메뉴명, 가격). 예: "모츠나베 세트", "규동 정식"',
      cafe: '인기 음료/디저트 3~5개 (실제 메뉴명, 가격)',
      hotel: '객실 타입 2~3개 (싱글/더블/트윈 등 + 1박 가격), 조식/부대시설 옵션. group이 같으면 택1 옵션',
      attraction: '입장권 종류, 체험 프로그램, 기념품 등',
      shopping: '인기 상품 카테고리, 먹거리, 추천 아이템',
      transport: '이용 가능한 교통수단 옵션 (급행/완행/택시 등 + 가격 비교)',
    };

    const systemContent = `You are a travel detail expert. Return specific sub-items for a given place as JSON array.

Each item must have:
- name: 한국어 (구체적인 이름. 부모 장소명 반복 금지. 예: "모츠나베 세트", "싱글룸", "공항급행")
- description: 한국어 1문장
- estimatedCost: integer in local currency
- currency: ISO 4217
- category: string
- selectable: true if user should pick this option (e.g., room type, menu choice)
- group: string key for mutually exclusive options (e.g., "room_type" for hotel rooms). null if independent add-on.

Return ONLY a JSON array, no markdown.`;

    const userContent = `"${placeName}" (${category}) in ${destination}.
${categoryGuide[category] || '세부 항목 3~5개'}`;

    // 게이트웨이 모드: system role 미지원 → 단일 user 메시지로 합침
    const messages: OpenAI.ChatCompletionMessageParam[] = isGatewayMode()
      ? [{ role: 'user', content: `${systemContent}\n\n---\n\n${userContent}` }]
      : [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ];

    const lightModel = process.env.OPENAI_LIGHT_MODEL || 'gpt-5.4-nano';

    let content: string | null = null;

    // nano (non-reasoning) — 30초 타임아웃
    try {
      const start = Date.now();
      content = await withTimeout(
        callStreaming(lightModel, messages, 1500),
        30_000,
      );
      console.log(`[AI Expand] ✓ 성공: ${lightModel} ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`[AI Expand] ✗ 실패: ${lightModel} (${err instanceof Error ? err.message : String(err)})`);
      return getMockExpanded(placeName, category, destination);
    }

    if (!content) return getMockExpanded(placeName, category, destination);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return getMockExpanded(placeName, category, destination);

    const parsed = expandedSubItemsSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) return getMockExpanded(placeName, category, destination);
    return parsed.data as ExpandedSubItem[];
  } catch (err) {
    console.error('[AI Expand] 실패:', err instanceof Error ? err.message : err);
    return getMockExpanded(placeName, category, destination);
  }
}

function getMockExpanded(placeName: string, category: string, destination: string): ExpandedSubItem[] {
  const isJapan = /일본|japan|도쿄|tokyo|오사카|osaka|교토|kyoto|후쿠오카|fukuoka/i.test(destination);
  const currency = isJapan ? 'JPY' : 'KRW';
  // placeName에서 핵심 이름만 추출 (괄호 제거)
  const shortName = placeName.replace(/\s*\(.*\)$/, '');
  void shortName; // mock에서는 사용하지 않음

  if (category === 'restaurant') {
    return isJapan
      ? [
          { name: '추천 세트 메뉴', description: '가장 인기 있는 조합 세트', estimatedCost: 1500, currency, category: 'restaurant', selectable: true, group: 'main' },
          { name: '단품 요리', description: '대표 단품', estimatedCost: 1000, currency, category: 'restaurant', selectable: true, group: 'main' },
          { name: '사이드 메뉴', description: '곁들임 요리', estimatedCost: 400, currency, category: 'restaurant', selectable: true },
          { name: '음료', description: '생맥주, 소프트드링크 등', estimatedCost: 500, currency, category: 'restaurant', selectable: true },
        ]
      : [
          { name: '추천 세트 메뉴', description: '가장 인기 있는 조합 세트', estimatedCost: 15000, currency, category: 'restaurant', selectable: true, group: 'main' },
          { name: '단품 요리', description: '대표 단품', estimatedCost: 10000, currency, category: 'restaurant', selectable: true, group: 'main' },
          { name: '사이드 메뉴', description: '곁들임 요리', estimatedCost: 4000, currency, category: 'restaurant', selectable: true },
          { name: '음료', description: '커피, 음료 등', estimatedCost: 5000, currency, category: 'restaurant', selectable: true },
        ];
  }

  if (category === 'attraction') {
    return isJapan
      ? [
          { name: '일반 입장권', description: '기본 입장', estimatedCost: 800, currency, category: 'attraction', selectable: true, group: 'ticket' },
          { name: '패스트패스/프리미엄', description: '우선 입장권', estimatedCost: 1500, currency, category: 'attraction', selectable: true, group: 'ticket' },
          { name: '체험 프로그램', description: '추가 체험 활동', estimatedCost: 500, currency, category: 'attraction', selectable: true },
          { name: '기념품', description: '인기 기념품', estimatedCost: 1000, currency, category: 'shopping', selectable: true },
        ]
      : [
          { name: '일반 입장권', description: '기본 입장', estimatedCost: 8000, currency, category: 'attraction', selectable: true, group: 'ticket' },
          { name: '패스트패스/프리미엄', description: '우선 입장권', estimatedCost: 15000, currency, category: 'attraction', selectable: true, group: 'ticket' },
          { name: '체험 프로그램', description: '추가 체험 활동', estimatedCost: 5000, currency, category: 'attraction', selectable: true },
          { name: '기념품', description: '인기 기념품', estimatedCost: 10000, currency, category: 'shopping', selectable: true },
        ];
  }

  if (category === 'hotel') {
    return isJapan
      ? [
          { name: '싱글/스탠다드 룸', description: '기본 1인 객실 (1박)', estimatedCost: 6000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '더블/트윈 룸', description: '2인 객실 (1박)', estimatedCost: 10000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '디럭스/스위트', description: '넓은 고급 객실 (1박)', estimatedCost: 18000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '조식 뷔페', description: '호텔 아침식사', estimatedCost: 1500, currency, category: 'restaurant', selectable: true },
          { name: '코인 세탁기', description: '빨래 1회', estimatedCost: 300, currency, category: 'hotel', selectable: true },
        ]
      : [
          { name: '싱글/스탠다드 룸', description: '기본 1인 객실 (1박)', estimatedCost: 60000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '더블/트윈 룸', description: '2인 객실 (1박)', estimatedCost: 100000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '디럭스/스위트', description: '넓은 고급 객실 (1박)', estimatedCost: 180000, currency, category: 'hotel', selectable: true, group: 'room' },
          { name: '조식 뷔페', description: '호텔 아침식사', estimatedCost: 15000, currency, category: 'restaurant', selectable: true },
          { name: '코인 세탁기', description: '빨래 1회', estimatedCost: 3000, currency, category: 'hotel', selectable: true },
        ];
  }

  if (category === 'shopping') {
    return isJapan
      ? [
          { name: '인기 상품', description: '가장 많이 찾는 품목', estimatedCost: 2000, currency, category: 'shopping', selectable: true },
          { name: '시식/먹거리', description: '시장 내 간식', estimatedCost: 500, currency, category: 'restaurant', selectable: true },
          { name: '의류/잡화', description: '패션 아이템', estimatedCost: 3000, currency, category: 'shopping', selectable: true },
        ]
      : [
          { name: '인기 상품', description: '가장 많이 찾는 품목', estimatedCost: 20000, currency, category: 'shopping', selectable: true },
          { name: '시식/먹거리', description: '시장 내 간식', estimatedCost: 5000, currency, category: 'restaurant', selectable: true },
          { name: '의류/잡화', description: '패션 아이템', estimatedCost: 30000, currency, category: 'shopping', selectable: true },
        ];
  }

  if (category === 'transport') {
    return isJapan
      ? [
          { name: '일반/완행', description: '저렴한 일반 열차', estimatedCost: 400, currency, category: 'transport', selectable: true, group: 'type' },
          { name: '급행/특급', description: '빠른 급행 열차', estimatedCost: 920, currency, category: 'transport', selectable: true, group: 'type' },
          { name: '택시', description: '편리하지만 비쌈', estimatedCost: 3000, currency, category: 'transport', selectable: true, group: 'type' },
          { name: '교통카드 충전', description: 'IC카드 (Suica/ICOCA)', estimatedCost: 2000, currency, category: 'transport', selectable: true },
        ]
      : [
          { name: '지하철/버스', description: '대중교통', estimatedCost: 1400, currency, category: 'transport', selectable: true, group: 'type' },
          { name: '택시', description: '편리하지만 비쌈', estimatedCost: 15000, currency, category: 'transport', selectable: true, group: 'type' },
          { name: '교통카드 충전', description: '교통카드', estimatedCost: 10000, currency, category: 'transport', selectable: true },
        ];
  }

  // cafe etc
  return isJapan
    ? [
        { name: '시그니처 음료', description: '대표 음료', estimatedCost: 600, currency, category: 'cafe', selectable: true },
        { name: '디저트/케이크', description: '인기 디저트', estimatedCost: 500, currency, category: 'cafe', selectable: true },
        { name: '추가 음료', description: '아메리카노 등', estimatedCost: 400, currency, category: 'cafe', selectable: true },
      ]
    : [
        { name: '시그니처 음료', description: '대표 음료', estimatedCost: 6000, currency, category: 'cafe', selectable: true },
        { name: '디저트/케이크', description: '인기 디저트', estimatedCost: 5000, currency, category: 'cafe', selectable: true },
        { name: '추가 음료', description: '아메리카노 등', estimatedCost: 4000, currency, category: 'cafe', selectable: true },
      ];
}
