# 데이터베이스 개발 가이드

> 이 매뉴얼은 DB 스키마 설계, 쿼리 작성, 마이그레이션 시 참조한다.
> 관련 매뉴얼: `backend.md`, `security.md`

## 스키마 설계 원칙

- 모든 테이블에 `id`, `created_at`, `updated_at` 컬럼 필수
- 삭제는 soft delete 사용: `deleted_at` 컬럼 (nullable timestamp)
- 외래키 제약조건 반드시 설정
- 인덱스: 자주 조회되는 컬럼, WHERE/JOIN 조건 컬럼에 설정

## 네이밍 규칙

- 테이블명: snake_case, 복수형 (예: `trip_plans`, `travel_spots`)
- 컬럼명: snake_case (예: `start_date`, `user_id`)
- 외래키: `{참조테이블_단수}_id` (예: `trip_plan_id`)
- 인덱스: `idx_{테이블}_{컬럼}` (예: `idx_trip_plans_user_id`)

## 쿼리 작성 규칙

- SELECT *는 금지. 필요한 컬럼만 명시
- N+1 쿼리 금지. JOIN 또는 서브쿼리로 해결
- 사용자 입력은 반드시 파라미터 바인딩 사용 (SQL Injection 방지)
- 대량 데이터 조회 시 LIMIT/OFFSET 또는 커서 기반 페이지네이션 필수

## 마이그레이션 규칙

- 마이그레이션 파일명: `{timestamp}_{설명}.sql` (예: `20260308_create_trip_plans.sql`)
- 모든 마이그레이션은 UP/DOWN 모두 작성
- 기존 데이터가 있는 컬럼 타입 변경 시 데이터 마이그레이션 계획 수립 필수
- 프로덕션 테이블 직접 수정 절대 금지

## 트랜잭션 규칙

- 여러 테이블을 동시에 변경하는 작업은 반드시 트랜잭션으로 감싼다
- 트랜잭션 내에서 외부 API 호출 금지
- 데드락 방지를 위해 테이블 접근 순서를 일관되게 유지

## Google Places API 데이터 저장 규칙

> **Google Places API ToS에 따라 `place_id`만 DB에 저장 가능.**

### 허용되는 저장

```sql
-- trip_items 테이블: place_id만 저장
CREATE TABLE trip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  place_id VARCHAR(255) NOT NULL,          -- Google place_id (저장 허용)
  place_name_snapshot VARCHAR(255),         -- 생성 시점 스냅샷 (표시용)
  -- ...
);
```

### 금지되는 저장

```sql
-- 절대 금지: Google API 데이터를 별도 테이블에 캐싱
-- CREATE TABLE places_cache (
--   place_id VARCHAR PRIMARY KEY,
--   name VARCHAR,              -- 금지
--   rating DECIMAL,            -- 금지
--   opening_hours JSONB,       -- 금지
--   photo_urls TEXT[],         -- 금지
--   cached_at TIMESTAMPTZ
-- );
```

### Supabase 인증 구조 참고
- Supabase는 `auth.users` 테이블을 별도 스키마로 관리
- `public.user_profiles`에는 email/password를 넣지 않음
- `public.user_profiles.id`는 `auth.users.id`를 FK로 참조

## 금지 사항

- SELECT * 금지
- 파라미터 바인딩 없는 동적 쿼리 금지
- 마이그레이션 파일 수정 금지 (새로 생성)
- CASCADE DELETE는 명시적 승인 후에만 사용
- **Google Places API 데이터(place_id 제외) 캐싱 테이블 생성 금지**
