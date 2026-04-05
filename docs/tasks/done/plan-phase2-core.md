# Phase 2 핵심 연동 개발 계획서

## 목표
Phase 1 MVP(Mock 데이터, localStorage)를 Supabase Auth + DB 기반 실서비스로 전환

## 범위
Task 1~6 (Auth 인프라 → Auth UI → 미들웨어 → Trip DB → TanStack Query → Profile DB)

## 기술 결정
- **인증**: Supabase Auth (이메일/비밀번호), `getUser()` 사용 (getSession 금지)
- **상태관리**: tripStore(localStorage) → TanStack Query + Supabase DB로 교체
- **DB 접근**: Service 레이어가 SupabaseClient를 주입받아 RLS 활용
- **snake_case ↔ camelCase**: 서비스 계층에서 `helpers.ts` 유틸로 변환
- **인가**: RLS(1차) + 서비스 레이어 userId 필터(2차) 이중 방어

## 의존 관계
```
Task 1 (Auth 인프라) → Task 2 (Auth UI) → Task 3 (미들웨어)
                                              ↓
                                  Task 4 (Trip DB) → Task 5 (TanStack Query)
                                              ↓
                                  Task 6 (Profile DB)
```

## 선행 조건
- `npx supabase start` 로컬 DB 실행
- `.env.local`에 Supabase URL/anon key/service_role key 설정
