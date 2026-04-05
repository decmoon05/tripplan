# 관리자 시스템 — 역할 기반 Rate Limit + Admin 대시보드

## 목표
user_profiles에 role 추가 → developer/admin은 rate limit 면제 + 관리자 대시보드

## Phase 1: DB + 타입 (파일 1~2)
- 마이그레이션: role 컬럼 + admin RLS
- database.ts: UserRole 타입 추가

## Phase 2: 백엔드 로직 (파일 3~4)
- rateLimit.service.ts: role 기반 면제
- getAuthUser.ts: getAdminUser 헬퍼

## Phase 3: Admin API (파일 5~6)
- GET/PATCH /api/v1/admin/users
- GET /api/v1/admin/stats

## Phase 4: 프론트엔드 (파일 7~11)
- middleware.ts: /admin 보호
- admin/page.tsx + StatsCards + UsageChart + UserTable

## Phase 5: 초기 admin 설정 안내
