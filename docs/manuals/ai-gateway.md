# AI 게이트웨이 제약사항 가이드

> 이 매뉴얼은 AI 엔드포인트/프로바이더 코드 작성 시 반드시 참조한다.
> 관련 매뉴얼: `backend.md`, `error-handling.md`

## 게이트웨이 환경

`OPENAI_BASE_URL` 환경변수가 설정되면 **게이트웨이 모드**로 동작한다.
현재 mindlogic.ai (Cloudflare 프록시) 경유.

```ts
// src/lib/services/ai/prompt.ts
export function isGatewayMode(): boolean {
  return !!process.env.OPENAI_BASE_URL;
}
```

- 게이트웨이 모드: Cloudflare 프록시 경유 → 아래 3대 제약 적용
- 직접 API 모드: `OPENAI_BASE_URL` 미설정 → 제약 없음

---

## 3대 제약 (반드시 준수)

### 1. `role: 'system'` 사용 금지

게이트웨이가 `system` role을 지원하지 않음. **단일 `user` 메시지로 합쳐야** 한다.

```ts
// ❌ 금지 — 게이트웨이에서 500/504 발생
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
]

// ✅ 올바름 — 게이트웨이 모드에서는 단일 user 메시지
const messages = isGatewayMode()
  ? [{ role: 'user' as const, content: `${systemPrompt}\n\n${userPrompt}` }]
  : [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
```

### 2. Cloudflare 프록시 타임아웃 (~100초)

Cloudflare 프록시 읽기 타임아웃은 플랜에 따라 **100초 내외**이다 (Free/Pro/Business 기본값).
mindlogic.ai 게이트웨이의 정확한 설정은 알 수 없으므로 보수적으로 대응해야 한다.

1일 여행(첫 요청)은 프롬프트가 가벼워 60초 이내에 응답되지만,
**2일차부터는 previousPlaces + 여행 맥락 누적**으로 토큰이 급증하여 100초를 초과할 수 있다.

→ 2일 이상 여행은 반드시 **1일 단위로 분할** 요청해야 한다.

### 3. `max_tokens` 대신 `max_completion_tokens` 사용 (reasoning 모델)

gpt-5-mini 등 reasoning 모델은 내부 추론(reasoning)에 토큰을 소비한다.
`max_tokens: 4000` 설정 시 추론에 4000 토큰 전부 소진 → **content가 빈 문자열**로 반환된다.

```ts
// ❌ 금지 — reasoning 토큰에 소진되어 빈 응답
max_tokens: 4000,

// ✅ 올바름 — reasoning + 실제 출력 모두 포함
max_completion_tokens: 8000,  // 1일 분할 요청
max_completion_tokens: 16000, // 전체 요청
```

빈 응답 디버깅: `finish_reason: "length"` + `reasoning_tokens == completion_tokens`이면 이 문제.

### 4. 504 응답은 JSON이 아닌 HTML

504 발생 시 Cloudflare가 HTML 에러 페이지를 반환한다.
`response.json()` 호출 시 파싱 에러가 발생하므로 **HTML 응답 감지 및 처리**가 필수.

---

## 타임아웃 정책

| 모드 | 클라이언트 타임아웃 | 비고 |
|------|---------------------|------|
| 게이트웨이 (`isGatewayMode()`) | **120초** (120_000ms) | Cloudflare ~100초보다 여유있게 |
| 직접 API | **120초** (120_000ms) | OpenAI/Claude 직접 호출 |

```ts
timeout: isGatewayMode() ? 120_000 : 120_000,
```

### 분할 요청 전략 (게이트웨이 모드 전용)

2일 이상 여행은 1일씩 분할 요청하여 타임아웃을 회피한다.
**1일차는 단독 요청으로 빠르지만, 2일차부터 previousPlaces·맥락 누적으로 토큰이 급증**하므로 분할이 필수.

- `buildSingleDayUserPrompt()` 사용 (src/lib/services/ai/prompt.ts)
- `buildSystemPrompt(true)` — 압축 시스템 프롬프트로 토큰 절약
- 이전 날짜 장소 목록을 `previousPlaces`로 전달하여 중복 방지

---

## Claude 게이트웨이

### 엔드포인트

`ANTHROPIC_BASE_URL` 환경변수로 Claude 게이트웨이를 설정한다.

### system 파라미터 지원

Anthropic API는 `system`이 **top-level 파라미터**이다 (OpenAI와 달리 messages 배열 안이 아님).
따라서 OpenAI 게이트웨이의 "system role 금지" 제약이 Claude에는 **미적용**된다.

```ts
// Claude API — system은 top-level param → 게이트웨이 제약 없음
await anthropic.messages.create({
  model, max_tokens, system: systemPrompt,
  messages: [{ role: 'user', content: userContent }],
});
```

### 스트리밍

`ANTHROPIC_BASE_URL` 게이트웨이가 SSE 스트리밍을 지원하지 않을 수 있다.
`claude.provider.ts`는 스트리밍 실패 시 비스트리밍으로 자동 폴백한다.

### 폴백 체인

```
callClaudeWithRetry():
  1. Claude 스트리밍 (85초 타임아웃)
  2. Claude 비스트리밍 (90초 타임아웃, 1초 대기)
  3. OpenAI nano 폴백 (55초 타임아웃)
  4. throw → ai.service.ts가 catch → 크로스 프로바이더 → mock
```

---

## 환경변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `AI_PROVIDER` | 메인 프로바이더 | `claude`, `openai`, `mock` |
| `ANTHROPIC_API_KEY` | Claude API 키 | |
| `ANTHROPIC_MODEL` | Claude 모델 | `claude-sonnet-4-6` |
| `ANTHROPIC_BASE_URL` | Claude 게이트웨이 URL | `/v1/gateway/claude` |
| `OPENAI_API_KEY` | OpenAI API 키 | |
| `OPENAI_MODEL` | OpenAI 메인 모델 (reasoning) | `gpt-5.4-mini` |
| `OPENAI_LIGHT_MODEL` | 경량 쿼리 모델 (non-reasoning) | `gpt-5.4-nano` |
| `OPENAI_FALLBACK_MODEL` | OpenAI 폴백 모델 | `gpt-5-mini` |
| `OPENAI_BASE_URL` | OpenAI 게이트웨이 URL | |

---

## 새 AI 엔드포인트 체크리스트

새로운 AI API 엔드포인트나 프로바이더 함수를 작성할 때 아래를 반드시 확인:

- [ ] `isGatewayMode()` import 했는가? (`src/lib/services/ai/prompt.ts`)
- [ ] 게이트웨이 모드에서 `role: 'system'` 제거했는가? (단일 `user` 메시지로 합침)
- [ ] `max_completion_tokens`를 사용했는가? (`max_tokens` 금지 — reasoning 모델 빈 응답 원인)
- [ ] timeout을 120_000으로 설정했는가?
- [ ] catch 블록에서 에러 로깅하는가? (무음 실패 금지)
- [ ] 504 HTML 응답 처리가 되는가? (JSON 파싱 실패 대비)

---

## 기존 구현 참조 (올바른 예시)

| 파일 | 설명 |
|------|------|
| `src/lib/services/ai/claude.provider.ts` | Claude 메인 프로바이더 — 스트리밍/비스트리밍/nano 3-layer 폴백, 일 단위 청킹 |
| `src/lib/services/ai/openai.provider.ts` | OpenAI 프로바이더 — 게이트웨이/직접 분기, 청크 분할 요청 |
| `src/lib/services/ai/expandPlace.ts` | 장소 확장 — OPENAI_LIGHT_MODEL(nano) 사용 |
| `src/lib/services/ai/popularPlaces.ts` | 인기 장소 — OPENAI_LIGHT_MODEL(nano) 사용 |
| `src/lib/services/ai.service.ts` | 크로스 프로바이더 폴백 체인 (claude→openai→mock) |
