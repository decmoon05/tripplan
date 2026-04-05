# TripPlan 배포 가이드

## 로컬 vs 원격 Supabase

로컬 Supabase(127.0.0.1)와 원격 Supabase(*.supabase.co)는 **완전히 별개**다.
- 데이터 (유저, 여행, 평점 등) → **공유 안 됨**
- 마이그레이션 (테이블, RLS, 트리거) → `supabase db push`로 적용 가능
- Storage 버킷 → 수동 생성 필요
- 관리자 권한 → 수동 설정 필요

---

## 1단계: 원격 Supabase 설정

### 1-1. 프로젝트 연결
```bash
npx supabase link --project-ref wpszlftrmolldvaqdutm
```

### 1-2. 마이그레이션 적용 (테이블 + RLS + 트리거)
```bash
npx supabase db push
```
이 명령어 하나로 `supabase/migrations/` 폴더의 **전체 28개 SQL 파일**이 순서대로 실행된다.
수동으로 하나하나 실행할 필요 없음.

포함되는 것:
- 테이블 생성 (trips, trip_items, user_profiles, travel_rooms 등)
- RLS 정책 (행 수준 보안)
- 트리거 (role 변경 차단 등)
- 인덱스
- 함수 (is_admin() 등)

### 1-3. 관리자 계정 설정
마이그레이션 후, 원격 DB에서 admin 권한 부여:
```sql
-- Supabase Dashboard > SQL Editor에서 실행
ALTER TABLE public.user_profiles DISABLE TRIGGER trg_prevent_role_self_promotion;

UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'decmoon05@naver.com'
);

ALTER TABLE public.user_profiles ENABLE TRIGGER trg_prevent_role_self_promotion;
```

**주의:** 해당 이메일로 먼저 회원가입해야 user_profiles 레코드가 생긴다.

### 1-4. Storage 버킷 생성
Supabase Dashboard > Storage > New Bucket:
- 이름: `trip-photos`
- Public: No (Private)
- File size limit: 10MB
- Allowed MIME types: `image/*`

---

## 2단계: 환경변수 설정

### Vercel 환경변수
```
NEXT_PUBLIC_SUPABASE_URL=https://wpszlftrmolldvaqdutm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<원격 anon key>
SUPABASE_SERVICE_ROLE_KEY=<원격 service role key>

# AI (필수 — 하나 이상)
GEMINI_API_KEY=<Google AI Studio에서 발급>
AI_PROVIDER=gemini

# AI (선택 — fallback)
ANTHROPIC_API_KEY=<있으면>
OPENAI_API_KEY=<있으면>

# Google Maps (필수 — 장소 검색)
GOOGLE_PLACES_API_KEY=<Google Cloud Console>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<같은 키>

# 앱
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 필요 없는 것 (무료 공개 API)
- ~~OPENWEATHER_API_KEY~~ → Open-Meteo 사용 (키 불필요)
- ~~환율 API 키~~ → open.er-api.com (키 불필요)

---

## 3단계: Vercel 배포

```bash
# Vercel CLI
npx vercel --prod

# 또는 GitHub 연결 시 자동 배포
git push origin main
```

---

## 4단계: 배포 후 확인

### 헬스체크
```
GET https://your-domain.vercel.app/api/health
→ { "status": "ok", ... }
```

### 관리자 대시보드
1. 배포된 사이트에서 로그인 (decmoon05@naver.com)
2. 홈페이지 nav에 "관리자" 링크 확인
3. `/admin` → 6개 탭 확인
4. ⚙️ 설정 → AI provider/한도 확인
5. 🏥 헬스 → DB/외부API 연결 상태 확인

### 기능 확인
- [ ] 회원가입 → 온보딩 → 일정 생성 (AI 동작)
- [ ] 날씨 카드 표시 (Open-Meteo)
- [ ] 환율 정보 표시
- [ ] 지도 표시 (Google Maps)
- [ ] Travel Room 생성/참여

---

## 마이그레이션 관리

### 새 마이그레이션 추가 시
```bash
# 로컬에서 개발/테스트
npx supabase migration new 마이그레이션_이름

# 원격에 적용
npx supabase db push
```

### 현재 마이그레이션 목록 (28개)
```
20260309000001_create_tables.sql          ← 핵심 테이블
20260309000002_rls_policies.sql           ← RLS
20260310000001_api_usage_log.sql
20260310000002_add_coordinates.sql
20260310000003_share_token.sql
20260310000004_fix_share_rls.sql
20260310000005_add_currency_confidence.sql
20260310000006_user_place_preferences.sql
20260311000001_profile_personalization.sql
20260311000002_lifestyle_columns.sql
20260312000001_security_fixes.sql
20260318000001_add_reason_tags.sql
20260318000002_add_transit_business_info.sql
20260319000001_place_cache.sql
20260319000002_add_verified.sql
20260320000001_user_roles.sql             ← admin/developer/user
20260320000002_custom_preferences.sql
20260320000003_place_photo_reference.sql
20260326000001_add_summary_advisories_subactivities.sql
20260328000000_travel_rooms.sql
20260329000001_trip_checklists.sql
20260329000002_trip_expenses.sql
20260329000003_trip_notifications.sql
20260329000004_room_votes.sql
20260329000005_room_messages.sql
20260329000006_trip_ratings.sql
20260329000007_trip_photos.sql
20260329000010_trip_completed_status.sql  ← completed + ratings memo
```

---

## 주의사항

1. **`.env.local`은 절대 커밋하지 마라** — 키가 들어있음
2. **원격 service_role_key는 서버사이드에서만** — `NEXT_PUBLIC_`으로 노출하면 안 됨
3. **`supabase db push`는 한 번 적용된 마이그레이션은 건너뜀** — 안전하게 반복 실행 가능
4. **원격 DB에서 직접 테이블 수정하지 마라** — 항상 마이그레이션 파일로 관리
5. **관리자 권한은 배포마다 한 번 설정** — seed_admin.sql 실행
