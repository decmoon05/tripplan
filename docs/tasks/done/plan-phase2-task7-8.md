# Phase 2 Task 7~8 계획서

## Task 7: AI API 실제 연동
- Mock AI → OpenAI/Claude Strategy 패턴으로 전환
- 환경변수 `AI_PROVIDER`로 런타임 전환
- 파일: ai/types.ts, openai.provider.ts, claude.provider.ts, ai.service.ts

## Task 8: Rate Limiting
- user_id 기반 일별 API 호출 제한
- Supabase DB로 사용량 추적
- 파일: rateLimit.service.ts, migration, generate/route.ts
