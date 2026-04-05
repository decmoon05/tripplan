# AI 프로바이더 아키텍처 전환 — Claude 메인 + OpenAI Nano 경량

## 목표
- Claude Sonnet을 메인 일정 생성 모델로 전환 (reasoning 모델 토큰 낭비 제거)
- 경량 쿼리(expand, popularPlaces)는 GPT-5.4 nano로 분리
- 3-layer 폴백: Claude streaming → non-streaming → OpenAI nano → mock

## 수정 파일
1. `src/lib/services/ai/prompt.ts` — isReasoningModel nano 제외, buildProfileSection, buildSingleDayPrompt
2. `src/lib/services/ai/claude.provider.ts` — 스트리밍, 재시도, 일 단위 청킹, nano 폴백
3. `src/lib/services/ai.service.ts` — 크로스 프로바이더 폴백 체인
4. `src/lib/services/ai/expandPlace.ts` — OPENAI_LIGHT_MODEL 사용
5. `src/lib/services/ai/popularPlaces.ts` — OPENAI_LIGHT_MODEL 사용
6. `docs/manuals/ai-gateway.md` — Claude 게이트웨이 문서 추가
