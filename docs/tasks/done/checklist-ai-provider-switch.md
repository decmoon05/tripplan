# 체크리스트 — AI 프로바이더 전환

- [x] Phase 1: prompt.ts — isReasoningModel nano 제외, buildProfileSection, buildSingleDayPrompt
- [x] Phase 2: claude.provider.ts — 스트리밍, 재시도, 일 단위 청킹, nano 폴백
- [x] Phase 3: ai.service.ts — 크로스 프로바이더 폴백
- [x] Phase 4: expandPlace.ts + popularPlaces.ts — OPENAI_LIGHT_MODEL
- [x] Phase 5: ai-gateway.md 문서 업데이트
- [x] 빌드 검증 (npx next build) — 성공
