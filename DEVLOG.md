# 개발 로그 (DevLog)

## [2026-04-02] AI 일정 생성 v3 파이프라인 + 데이터 인프라

### 변경 요약
- 변경 파일: 79개 (수정) + 116개 (신규) | +4,877줄 / -1,556줄

### 주요 변경
1. **v3 하이브리드 파이프라인** — AI는 장소만, 코드가 배치 (ItiNera 논문 기반)
2. **데이터 인프라** — Geoapify + Nominatim + Overpass + OSRM (전부 무료)
3. **Places FieldMask Essentials** — $0.032 → $0.005/건 (84% 절감, 무료 10,000건/월)
4. **프로덕션 v3 연결** — stream/route.ts가 v3 파이프라인 사용 (이전: v2만 사용)
5. **비용 추적** — Gemini usageMetadata 실시간 추출 + V3CostTracker
6. **모델 관리** — models.ts 중앙화, 2.5-pro/3.1-pro 자동 차단
7. **테스트** — 42 시나리오 + 22 검증 규칙 | PASS 80% | $0.08/건
8. **feasibility check** — 프로필 관심사 맥락 설명 추가

### 코드 리뷰: 이슈 5건 (Medium 3, Low 2)
- exchange/weather API 인증 없음 (의도적 공개인지 확인 필요)
- feasibilityCheck 프롬프트 인젝션 가능
- v3 console.log 36개 (프로덕션 노이즈)

### 보안 리뷰: 10/10 점검 | Critical 0, High 0, Medium 3, Low 1

### TODO
- [ ] exchange/weather 인증 확인
- [ ] feasibilityCheck 입력값 새니타이징
- [ ] v3 console.log 조건부 출력
- [ ] v2 레거시 코드 제거 (v3 안정화 후)
- [ ] 프로덕션 v3 실동작 검증

---

## [2026-03-28] 전체 코드베이스 리뷰 리포트

### 변경 요약
- 대상 파일 수: **115개** (.ts/.tsx)
- 총 코드 라인: **5,042줄**
- 리뷰 범위: 전체 프로젝트 (untracked, 첫 커밋 전)

---

### 코드 리뷰 결과

#### 발견된 이슈: 총 50건

| 심각도 | 건수 |
|--------|------|
| Critical | 4건 |
| High | 10건 |
| Medium | 22건 |
| Low | 14건 |

#### Critical 이슈

1. **RLS 정책 미버전관리** — `supabase/migrations/` 폴더가 비어있음. RLS 정책을 코드에서 감사 불가.
2. **Error Boundary 없음** — `layout.tsx`에 React Error Boundary 미적용. 앱 전체 화이트스크린 위험.
3. **console.warn 프로덕션 노출** — `TimelineCard.tsx:130,159`, `TripCreatorForm.tsx:195`에서 내부 구현 세부사항 브라우저 콘솔 노출.
4. **Gemini 스트리밍 이중 API 호출** — `gemini.provider.ts:438-464`에서 스트리밍 후 동일 요청 재호출. 비용 2배, 레이턴시 2배.

#### High 이슈

1. **IDOR 취약점 (expand endpoint)** — `ai/expand/route.ts:23-26`: `itemId`로 다른 유저의 trip_item 수정 가능. 소유권 검증 없음.
2. **feasibility-check Zod 미적용** — `feasibility-check/route.ts:13-14`: 입력값 수동 캐스팅, 스키마 검증 없음.
3. **expand endpoint rate limiting 없음** — 다른 AI 엔드포인트는 모두 적용되어 있으나 이 엔드포인트만 누락.
4. **optional tripId in update/delete** — `trip.service.ts:164,197`: tripId가 optional이라 RLS 외 보호 없이 호출 가능.
5. **MapView 비null assertion** — `MapView.tsx:69,70,113`: nullable 좌표에 `!` 사용, 런타임 에러 위험.
6. **MapView useEffect 의존성 버그** — `MapView.tsx:88`: `itemsWithCoords.length` → `itemsWithCoords`여야 함. 같은 수의 다른 아이템으로 교체 시 맵 미갱신.
7. **handleRoleChange 에러 미처리** — `admin/page.tsx:69-81`: try/catch 없이 throw, Error Boundary도 없음.
8. **Header에서 매 마운트마다 Supabase 클라이언트 생성** — `Header.tsx:19`: useEffect 내 `createClient()` 호출.
9. **TimelineCard useCallback 의존성 버그** — `TimelineCard.tsx:134`: `subItems.length` → `subItems`여야 함.
10. **AI 응답 JSON.parse 무검증 3건** — `expandPlace.ts:135`, `popularPlaces.ts:330`, `feasibilityCheck.ts:94`: Zod 없이 `as` 캐스팅.

#### Medium 이슈 (상위 10건)

1. **destination 프롬프트 인젝션** — `prompt.ts:239,353`: destination 필드 새니타이즈 불일치 (일부만 적용)
2. **in-memory rate limiting** — `middleware.ts:7`: 서버리스 환경에서 무효
3. **Admin 유저 목록 페이지네이션 없음** — `admin/users/route.ts:33`
4. **trip items POST Zod 부분 우회** — `items/route.ts:50-62`: Zod 이후 추가 필드 수동 캐스팅
5. **updateTripSchema 날짜 교차검증 없음** — `validators/tripItem.ts:35-40`
6. **DELETE itemId UUID 미검증** — `items/route.ts:102`
7. **gemini.provider.ts에 `any` 타입 3건** — `:160,191,254`
8. **rate limit 매 요청 DB 역할 조회** — `rateLimit.service.ts:16-24`
9. **Google Places API key 무조건 빈 배열 반환** — `googlePlaces.service.ts:6,139`
10. **Admin PATCH Zod 미적용** — `admin/users/route.ts:81`

---

### 보안 리뷰 결과 (OWASP Top 10)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| A01 | Broken Access Control | ⚠️ HIGH | expand endpoint IDOR, optional tripId |
| A02 | Cryptographic Failures | ✅ PASS | 하드코딩 시크릿 없음, env var 사용 |
| A03 | Injection | ⚠️ MEDIUM | 프롬프트 인젝션 (destination 필드), SQL injection은 안전 |
| A04 | Insecure Design | ⚠️ HIGH | expand rate limit 누락, in-memory rate limit |
| A05 | Security Misconfiguration | ⚠️ MEDIUM | RLS 미버전관리, env var 런타임 검증 없음 |
| A06 | Vulnerable Components | ✅ PASS | 알려진 취약 버전 없음 |
| A07 | Auth Failures | ✅ PASS | getAuthUser() 일관 사용, JWT 서버검증 |
| A08 | Data Integrity | ⚠️ MEDIUM | AI 응답 무검증 파싱 3건, 부분 Zod 우회 |
| A09 | Logging Failures | ⚠️ LOW | SSE 에러 메시지 내부정보 노출 가능 |
| A10 | SSRF | ✅ PASS | 사용자 URL 직접 fetch 없음 |

**보안 점수: 6/10 PASS** (4개 항목에서 이슈 발견)

---

### 긍정적 발견 (잘 된 부분)

- **인증 일관성** — 모든 API route에서 `getAuthUser()` 정상 호출
- **SQL Injection 방지** — raw query 없음, Supabase 쿼리빌더 일관 사용
- **XSS 방지** — Zod validator에서 `<>` 스트립 transform 적용
- **Trip 소유권 검증** — trip CRUD에서 `user_id` 필터 + RLS 이중 보호
- **관리자 자기역할 변경 방지** — admin PATCH에서 self-role-change 차단
- **입력 검증** — 대부분의 엔드포인트에서 Zod 스키마 적용
- **에러 핸들링 중앙화** — `handleApiError`로 일관된 에러 응답
- **서비스 키 분리** — `SUPABASE_SERVICE_ROLE_KEY` 서버 전용

---

### 우선 수정 권장 (Top 5)

| 순위 | 이슈 | 영향 |
|------|------|------|
| 1 | expand endpoint IDOR + rate limit 추가 | 보안 — 타인 데이터 수정 가능 |
| 2 | Gemini 스트리밍 이중호출 수정 | 비용 — AI API 비용 2배 |
| 3 | Error Boundary 추가 | UX — 앱 전체 크래시 방지 |
| 4 | RLS 마이그레이션 파일 버전관리 | 운영 — 보안 정책 감사 가능 |
| 5 | AI 응답 Zod 검증 추가 (3건) | 안정성 — 런타임 에러 방지 |

---

### 기술 부채

- **프로바이더 코드 중복** — claude/openai/gemini 프로바이더에서 `normalizePlaceName`, `isFuzzyDuplicate`, `withTimeout` 등 동일 로직 3벌 존재
- **환경변수 런타임 검증 없음** — 앱 시작 시 필수 env var 확인 미구현
- **정적 환율 데이터** — `currency.ts`에 2026-03 기준 환율 하드코딩
- **generateId 유틸 미사용** — Supabase UUID 사용으로 `utils/id.ts` 데드코드 가능성

---

### 남은 작업 (TODO)

- [ ] `ai/expand/route.ts` — 소유권 검증 + rate limiting 추가
- [ ] `gemini.provider.ts:438-464` — 스트리밍 이중호출 제거
- [ ] `layout.tsx` — React Error Boundary 추가
- [ ] `supabase/migrations/` — RLS 정책 마이그레이션 파일 생성
- [ ] `expandPlace.ts`, `popularPlaces.ts`, `feasibilityCheck.ts` — AI 응답 Zod 검증 추가
- [ ] `prompt.ts` — destination 필드 새니타이즈 일관 적용
- [ ] `feasibility-check/route.ts` — Zod 스키마 적용
- [ ] `console.warn` 3건 제거
- [ ] `MapView.tsx:88` — useEffect 의존성 수정
- [ ] `trip.service.ts:164,197` — tripId 필수로 변경
