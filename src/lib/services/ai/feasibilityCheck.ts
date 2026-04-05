import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { FeasibilityCheckResult } from './types';

/** Anthropic 클라이언트 지연 초기화 */
let _client: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      timeout: 30_000,
      maxRetries: 0,
    });
  }
  return _client;
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

const NO_ISSUES: FeasibilityCheckResult = { status: 'no_issues', message: null, options: [] };

interface FeasibilityInput {
  destination: string;
  specialNote: string;
  interests?: string[];
  customInterests?: string;
  companion?: string;
}

export async function checkFeasibility(input: FeasibilityInput): Promise<FeasibilityCheckResult> {
  const providerType = process.env.AI_PROVIDER || 'mock';

  if (providerType === 'mock') {
    return getMockResult(input);
  }

  try {
    const systemPrompt = `You are a travel feasibility checker with deep knowledge of geography, climate, pop culture locations, and regional characteristics.

The user wants to travel to a specific destination. Check ONLY if their EXPLICIT requests have issues.

## TWO TYPES OF INPUT:
1. "특별 요청" (specialNote): 사용자가 이번 여행을 위해 직접 쓴 것 → 가장 중요
2. "관심사" (interests): 프로필에 등록된 일반 취향 → 이번 여행에 해당 안 될 수 있음

## RULES:
- "특별 요청"에 적힌 내용이 목적지에서 불가능하면 → has_concerns (직접 요청이므로)
- "관심사"에만 있고 "특별 요청"에는 없는 내용이 목적지에서 제한적이면:
  → has_concerns로 경고하되, 반드시 message에 "회원님의 프로필 관심사 'OO'을 고려했을 때" 라고 맥락을 설명
  → 사용자가 "이번 여행에는 해당 안 됨"으로 무시할 수 있게 Option C 제공
- 일반적인 여행 요청(맛집, 온천, 자연, 가족여행, 렌터카, 체력 고려 등)은 어디서든 가능 → no_issues

## RETURN has_concerns ONLY FOR THESE (specific impossible requests):

### 1. Geographic impossibility
A specific landmark/place that physically does not exist at the destination.
- "서울" + "타지마할" → 타지마할은 인도 아그라에 있음
- "오사카" + "에펠탑" → 에펠탑은 파리에 있음

### 2. Content location mismatch (anime/drama/film pilgrimage)
The fictional work's real-world locations are NOT at the destination. Be specific about WHERE the locations actually are.
- "사가현" + "주술회전 성지순례" → 주술회전 주요 배경지는 도쿄 시부야·신주쿠, 미야기현 센다이. 사가현에는 관련 장소가 거의 없음
- "오사카" + "슬램덩크 성지" → 슬램덩크 성지는 가마쿠라(가나가와현). 오사카 아님
- "서울" + "귀멸의 칼날 배경지" → 일본 작품이므로 한국에 성지 없음

### 3. Climate/seasonal mismatch
The weather or season at the destination doesn't support the activity.
- "사가현(규슈)" + "눈 보고 싶어요" → 규슈는 일본 남부, 겨울에도 적설이 매우 드묾. 눈을 보려면 홋카이도·토호쿠·나가노 추천
- "하와이" + "스키" → 열대 지역
- "홋카이도" + "7월에 벚꽃" → 홋카이도 벚꽃은 5월 초

### 4. Regional activity mismatch
The activity/experience is not available or not well-known in that specific region.
- "제주도" + "온천 료칸" → 한국에는 일본식 료칸 없음
- "도쿄" + "산호초 스노클링" → 도쿄 근처에 산호초 없음 (오키나와 추천)

### 5. Partial match (some things work, some don't)
When the destination partially satisfies the request but not fully.
- "도쿄" + "주술회전" → 시부야·신주쿠는 OK, 하지만 센다이 장면은 미야기현
→ has_concerns with message explaining what IS and ISN'T available

## IMPORTANT:
- STRICT RULE: ONLY check things the user EXPLICITLY wrote in their request.
- NEVER mention activities the user did NOT request. If the user didn't say "anime", don't mention anime. If the user didn't say "shopping", don't mention shopping.
- If the user's actual requests are achievable at the destination → return no_issues. Period.
- ONLY return has_concerns if a SPECIFIC thing the user WROTE cannot be done at the destination.
- Examples:
  - User: "규슈 온천, 맛집, 가족여행" → no_issues (all achievable in 규슈)
  - User: "규슈 + 주술회전 성지순례" → has_concerns (JJK locations are in Tokyo)
  - User: "규슈 + 스키" → has_concerns (no ski in 규슈)
- 반드시 한국어로 응답

Return JSON only (no markdown):
{
  "status": "no_issues" | "has_concerns",
  "message": "한국어로 구체적 설명 (no_issues면 null). 왜 안 되는지 + 어디서 가능한지 알려줘야 함",
  "options": [
    {
      "id": "A",
      "label": "한국어 선택지",
      "action": "proceed_limited" | "remove_request" | "suggest_destination" | "modify_request",
      "suggestedDestination": "suggest_destination일 때만",
      "modifiedNote": "선택 시 specialNote를 이걸로 교체"
    }
  ]
}

Rules:
- Provide 2-3 options (last option always "그냥 원래대로 진행")
- Option A: best alternative (usually suggest_destination with the correct city)
- Option B: modify request to fit the destination
- Option C: proceed as-is`;

    const userPrompt = `목적지: ${input.destination}
${input.specialNote ? `특별 요청: ${input.specialNote}` : '(특별 요청 없음)'}${input.interests?.length ? `\n관심사/가보고 싶은 곳: ${input.interests.join(', ')}` : ''}${input.customInterests ? `\n추가 관심사: ${input.customInterests}` : ''}${input.companion ? `\n동행: ${input.companion}` : ''}`;

    let text = '';

    if (providerType === 'gemini') {
      // Gemini로 feasibility check
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) throw new Error('GEMINI_API_KEY not set');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const flashModel = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
      const response = await withTimeout(
        ai.models.generateContent({
          model: flashModel, // feasibility는 빠른 Flash로 충분
          contents: userPrompt,
          config: { systemInstruction: systemPrompt },
        }),
        30_000,
      );
      text = response.text || '';
    } else {
      // Claude로 feasibility check
      const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
      const response = await withTimeout(
        getAnthropicClient().messages.create({
          model,
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        15_000,
      );
      text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    }

    if (!text) return NO_ISSUES;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NO_ISSUES;

    const parsed = JSON.parse(jsonMatch[0]) as FeasibilityCheckResult;

    // 안전장치: 잘못된 status면 no_issues
    if (parsed.status !== 'has_concerns' && parsed.status !== 'no_issues') {
      return NO_ISSUES;
    }

    return parsed;
  } catch (err) {
    console.error('[Feasibility] AI 실패, Mock 폴백:', err instanceof Error ? err.message : err);
    // AI 실패 시 Mock으로 폴백 (하드코딩 패턴이라도 잡음)
    return getMockResult(input);
  }
}

/** Mock: 키워드 매칭 기반 */
function getMockResult(input: FeasibilityInput): FeasibilityCheckResult {
  const { destination, specialNote } = input;
  const dest = destination.toLowerCase();
  const note = specialNote.toLowerCase();
  const allText = `${note} ${(input.interests || []).join(' ')} ${input.customInterests || ''}`.toLowerCase();

  // 주술회전 + 오사카 → 우려
  if (/주술회전|jujutsu|jjk/.test(note) && /오사카|osaka/.test(dest)) {
    return {
      status: 'has_concerns',
      message: '주술회전 성지순례 장소는 대부분 도쿄(시부야, 신주쿠)와 미야기현에 집중되어 있습니다. 오사카에는 관련 장소가 거의 없어 기대에 미치지 못할 수 있습니다.',
      options: [
        {
          id: 'A',
          label: '도쿄로 목적지 변경 (주술회전 성지 다수)',
          action: 'suggest_destination',
          suggestedDestination: '도쿄',
          modifiedNote: '주술회전 성지순례 (시부야, 신주쿠 중심)',
        },
        {
          id: 'B',
          label: '오사카 여행 + 애니메이션 관련 장소만 포함',
          action: 'modify_request',
          modifiedNote: '애니메이션/만화 관련 장소 방문 (점프샵, 덴덴타운 등)',
        },
        {
          id: 'C',
          label: '그냥 원래대로 진행',
          action: 'proceed_limited',
          modifiedNote: specialNote,
        },
      ],
    };
  }

  // 스키/스노보드 + 여름 목적지 (간단 예시)
  if (/스키|스노보드|ski|snowboard/.test(note) && /하와이|hawaii|괌|guam|발리|bali/.test(dest)) {
    return {
      status: 'has_concerns',
      message: `${destination}은(는) 열대 지역으로 스키/스노보드를 즐길 수 없습니다.`,
      options: [
        {
          id: 'A',
          label: '특별 요청 제거하고 여행 계속',
          action: 'remove_request',
          modifiedNote: '',
        },
        {
          id: 'B',
          label: '그냥 원래대로 진행',
          action: 'proceed_limited',
          modifiedNote: specialNote,
        },
      ],
    };
  }

  // ── 콘텐츠 성지순례 불일치 (애니/드라마 로케이션) ──
  const CONTENT_LOCATIONS: Record<string, { locations: string; correctDest: string }> = {
    '주술회전': { locations: '도쿄 시부야·신주쿠, 미야기현 센다이', correctDest: '도쿄' },
    'jujutsu': { locations: '도쿄 시부야·신주쿠, 미야기현 센다이', correctDest: '도쿄' },
    '슬램덩크': { locations: '가나가와현 가마쿠라·쇼난', correctDest: '가마쿠라' },
    'slam dunk': { locations: '가나가와현 가마쿠라·쇼난', correctDest: '가마쿠라' },
    '너의 이름은': { locations: '도쿄 신주쿠·요쓰야, 기후현 히다', correctDest: '도쿄' },
    '귀멸의 칼날': { locations: '후쿠오카 다자이후, 나라, 도쿄 아사쿠사', correctDest: '도쿄' },
    '하이큐': { locations: '미야기현 센다이', correctDest: '센다이' },
    '스파이패밀리': { locations: '도쿄 (모델: 서베를린)', correctDest: '도쿄' },
    '진격의 거인': { locations: '오이타현 우스키, 도쿄', correctDest: '도쿄' },
  };

  for (const [content, info] of Object.entries(CONTENT_LOCATIONS)) {
    if (allText.includes(content.toLowerCase())) {
      // 목적지가 실제 성지 위치와 일치하면 OK
      const correctLower = info.correctDest.toLowerCase();
      if (dest.includes(correctLower)) continue;
      // 일부 매치 체크 (도쿄 → 도쿄는 OK, 사가 → 도쿄는 NO)
      return {
        status: 'has_concerns',
        message: `${content} 관련 성지순례 장소는 주로 ${info.locations}에 있습니다. ${destination}에는 관련 장소가 거의 없어 기대에 미치지 못할 수 있습니다.`,
        options: [
          {
            id: 'A',
            label: `${info.correctDest}(으)로 목적지 변경`,
            action: 'suggest_destination',
            suggestedDestination: info.correctDest,
            modifiedNote: `${content} 성지순례`,
          },
          {
            id: 'B',
            label: `${destination} 여행 유지, 관련 요소만 포함`,
            action: 'modify_request',
            modifiedNote: `${destination} 관광 (${content} 관련 장소가 있으면 포함)`,
          },
          {
            id: 'C',
            label: '그냥 원래대로 진행',
            action: 'proceed_limited',
            modifiedNote: specialNote,
          },
        ],
      };
    }
  }

  // ── 기후 불일치 (눈, 벚꽃 등) ──
  const WARM_REGIONS = ['사가', '후쿠오카', '오키나와', '나가사키', '구마모토', '미야자키', '가고시마', '하와이', '괌', '발리', '세부', '다낭', '방콕', '호치민', '싱가포르'];
  const COLD_REGIONS = ['홋카이도', '삿포로', '아사히카와', '오타루'];

  const wantsSnow = /눈\s*(을|이|보|구경|체험)|스키|스노보드|snow|ski/.test(allText);
  const wantsCherry = /벚꽃|cherry|sakura|桜/.test(allText);

  if (wantsSnow && WARM_REGIONS.some(r => dest.includes(r.toLowerCase()))) {
    return {
      status: 'has_concerns',
      message: `${destination}은(는) 온난한 지역으로 겨울에도 적설이 매우 드뭅니다. 눈을 확실히 보려면 홋카이도, 나가노, 토호쿠 지역을 추천합니다.`,
      options: [
        {
          id: 'A',
          label: '홋카이도(삿포로)로 목적지 변경',
          action: 'suggest_destination',
          suggestedDestination: '삿포로',
          modifiedNote: '눈 체험, 겨울 관광',
        },
        {
          id: 'B',
          label: `${destination} 여행 유지, 눈 관련 요청 제거`,
          action: 'modify_request',
          modifiedNote: specialNote.replace(/눈[을이\s]*[보구경체험]*|스키|스노보드/g, '').trim() || `${destination} 관광`,
        },
        {
          id: 'C',
          label: '그냥 원래대로 진행',
          action: 'proceed_limited',
          modifiedNote: specialNote,
        },
      ],
    };
  }

  // 지리적 불일치: 특정 장소가 목적지와 다른 나라에 있는 경우
  const LANDMARK_LOCATION: Record<string, { city: string; country: string }> = {
    '타지마할': { city: '아그라', country: '인도' },
    'taj mahal': { city: '아그라', country: '인도' },
    '에펠탑': { city: '파리', country: '프랑스' },
    'eiffel': { city: '파리', country: '프랑스' },
    '자유의 여신상': { city: '뉴욕', country: '미국' },
    '만리장성': { city: '베이징', country: '중국' },
    '콜로세움': { city: '로마', country: '이탈리아' },
    '마추픽추': { city: '쿠스코', country: '페루' },
    '앙코르와트': { city: '시엠립', country: '캄보디아' },
    '피라미드': { city: '카이로', country: '이집트' },
  };

  for (const [landmark, loc] of Object.entries(LANDMARK_LOCATION)) {
    if (allText.includes(landmark.toLowerCase()) && !dest.includes(loc.city.toLowerCase())) {
      return {
        status: 'has_concerns',
        message: `${landmark}은(는) ${loc.country} ${loc.city}에 위치해 있어 ${destination}에서 방문할 수 없습니다.`,
        options: [
          {
            id: 'A',
            label: `${loc.city}(${loc.country})로 목적지 변경`,
            action: 'suggest_destination',
            suggestedDestination: loc.city,
            modifiedNote: `${landmark} 방문`,
          },
          {
            id: 'B',
            label: `${landmark} 관련 요청 제거하고 ${destination} 여행 계속`,
            action: 'remove_request',
            modifiedNote: specialNote.replace(new RegExp(landmark, 'gi'), '').trim(),
          },
          {
            id: 'C',
            label: '그냥 원래대로 진행',
            action: 'proceed_limited',
            modifiedNote: specialNote,
          },
        ],
      };
    }
  }

  return NO_ISSUES;
}
