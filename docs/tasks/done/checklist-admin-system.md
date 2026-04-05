# 체크리스트: 관리자 시스템

## Phase 1: DB + 타입
- [x] 마이그레이션 20260320000001_user_roles.sql
- [x] database.ts UserRole 타입 추가

## Phase 2: 백엔드 로직
- [x] rateLimit.service.ts role 기반 면제
- [x] getAuthUser.ts getAdminUser 헬퍼

## Phase 3: Admin API
- [x] GET/PATCH /api/v1/admin/users
- [x] GET /api/v1/admin/stats

## Phase 4: 프론트엔드
- [x] middleware.ts /admin 보호
- [x] admin/page.tsx
- [x] StatsCards.tsx
- [x] UsageChart.tsx
- [x] UserTable.tsx

## Phase 5: 검증
- [x] npx next build 성공
