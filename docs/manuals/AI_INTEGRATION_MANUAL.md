# AI 통합 매뉴얼

> AI 추천/LLM/Claude API 관련 작업 시 이 매뉴얼을 읽을 것.

---

## 1. 기본 원칙

- **AI 엔진**: Claude API (claude-sonnet-4-6 기본, 비용 최적화 시 claude-haiku-4-5)
- **AI 역할**: 여행지 추천, 동선 최적화, 실시간 이슈 체크
- **API 키**: 반드시 서버 사이드에서만 사용. 클라이언트 노출 절대 금지.
- **비용 관리**: 응답 캐싱 필수. 같은 요청 반복 시 DB에서 가져올 것.

---

## 2. Claude API 사용 패턴

### 기본 호출 구조
```typescript
// packages/ai/src/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function callClaude(prompt: string, systemPrompt?: string) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text;
}
```

---

## 3. 프롬프트 설계 원칙

### 사용자 프로파일 기반 추천 프롬프트
```
시스템: 당신은 개인화 여행 추천 전문가입니다.
사용자의 성향 프로파일을 기반으로 적합한 여행지를 추천합니다.
응답은 반드시 JSON 형식으로 반환하세요.

사용자 프로파일: {profile}
목적지: {destination}
여행 기간: {duration}
동행: {companions}
요청: 동선을 고려한 일정 초안 생성
```

### 응답 형식 강제 (구조화)
- AI 응답은 항상 JSON으로 받을 것.
- 프롬프트에 응답 스키마를 명시.
- JSON 파싱 실패 시 재시도 로직 포함.

---

## 4. 비용 최적화

### 캐싱 전략
```
캐시 키: destination + profile_hash + date
캐시 TTL: 24시간 (여행지 정보는 자주 변하지 않음)
실시간 이슈 체크: 캐시 없음 (항상 최신 정보 필요)
```

### 모델 선택 기준
| 작업 | 모델 | 이유 |
|------|------|------|
| 초기 프로파일 분석 | claude-sonnet-4-6 | 정확도 중요 |
| 여행지 추천 | claude-sonnet-4-6 | 복잡한 판단 |
| 단순 분류/태깅 | claude-haiku-4-5 | 비용 절약 |
| 실시간 이슈 체크 | claude-sonnet-4-6 | 웹 검색 포함 |

---

## 5. 개인화 데이터 처리

### 사용자 프로파일 구조
```typescript
interface UserProfile {
  personality: {
    planningStyle: 'spontaneous' | 'structured' | 'mixed';
    pace: 'relaxed' | 'moderate' | 'packed';
    preference: 'urban' | 'nature' | 'mixed';
  };
  interests: string[];      // ['anime', 'golf', 'photography', ...]
  foodPreferences: {
    cuisines: string[];
    priceRange: 'budget' | 'mid' | 'premium';
    dietary?: string[];     // ['vegetarian', 'halal', ...]
  };
  companions: CompanionType;  // 'solo' | 'couple' | 'friends' | 'family'
  priorities: {
    budget: 1 | 2 | 3 | 4 | 5;
    experience: 1 | 2 | 3 | 4 | 5;
    food: 1 | 2 | 3 | 4 | 5;
  };
}
```

---

## 6. Google Places API 통합

```typescript
// 여행지 기본 정보 조회
async function getPlaceDetails(placeId: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json`;
  const params = {
    place_id: placeId,
    fields: 'name,rating,formatted_address,opening_hours,price_level,photos,website',
    key: process.env.GOOGLE_PLACES_API_KEY,
  };
  // ... 캐시 먼저 확인 후 API 호출
}
```

- Google Places API 응답은 Redis에 1시간 캐싱.
- 층수(floor) 정보: Google Maps에 없는 경우 AI 웹검색으로 보완.

---

## 7. 실시간 이슈 체크

여행 완성 후 최종 확인 단계:
1. 목적지 공사/폐업 여부
2. 공휴일/임시 휴무
3. 특수 이벤트 (축제, 대규모 행사)
4. 안전 경보 (여행 경보, 날씨)

```typescript
// Claude의 web_search 도구 활용
const issueCheckPrompt = `
다음 여행지들의 현재 상태를 확인해주세요:
{places}

확인 항목: 공사 여부, 임시 휴무, 특수 이벤트, 안전 이슈
여행 날짜: {travelDate}
JSON 형식으로 반환: { placeId, status, issues: string[] }
`;
```
