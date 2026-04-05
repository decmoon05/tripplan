# TripPlan 프로젝트 — AI 작업 가이드

## 프로젝트 현재 상태 (2026-03-29 기준)

**TripPlan**은 AI 기반 맞춤 여행 계획 앱이다.
핵심 흐름(프로필 → AI 일정 생성 → 조회/수정)이 동작하며, Phase 1~5 기능이 전부 구현됨.

### 기술 스택
- **프론트엔드**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion
- **백엔드**: Next.js API Routes, Supabase (Auth + DB + Storage + Realtime)
- **AI**: Gemini 2.5 Pro/Flash + Claude + OpenAI (fallback chain), 스트리밍 지원
- **인프라**: Vercel 배포 예정, Supabase 호스팅
- **개발 도구**: gstack (글로벌 설치됨), Claude Code hooks (tsc 자동 체크)

### 구현 완료된 기능 (Phase 1~5)

| Phase | 기능 | 상태 | 핵심 파일 |
|-------|------|------|-----------|
| 핵심 | 프로필/온보딩 | ✅ | `src/app/onboarding/`, `src/stores/profileStore.ts` |
| 핵심 | AI 일정 생성 (스트리밍) | ✅ | `src/lib/services/ai/`, `src/app/api/v1/ai/generate/` |
| 핵심 | 일정 조회/수정 | ✅ | `src/components/features/trip-view/TripDetailView.tsx` |
| 핵심 | Google Maps 연동 | ✅ | `src/components/features/map/MapView.tsx` |
| 핵심 | Travel Room (그룹 여행) | ✅ | `src/app/rooms/`, `src/app/api/v1/rooms/` |
| 핵심 | 공유 링크 | ✅ | `src/app/shared/[token]/` |
| 핵심 | 관리자 대시보드 | ✅ | `src/app/admin/` |
| 1-1 | 실시간 날씨 (Open-Meteo, 키 불필요) | ✅ | `src/lib/services/weather.service.ts`, `WeatherCard.tsx` |
| 1-2 | 실시간 환율 (open.er-api) | ✅ | `src/lib/services/exchange.service.ts`, `ExchangeBadge.tsx` |
| 1-3 | 비상 연락처 (22개 도시) | ✅ | `src/lib/data/emergency-contacts.ts`, `EmergencyInfo.tsx` |
| 2-1 | 준비물 체크리스트 | ✅ | `src/app/api/v1/trips/[tripId]/checklist/`, `ChecklistPanel.tsx` |
| 2-2 | 인쇄/PDF (CSS print) | ✅ | `PrintButton.tsx`, `globals.css @media print` |
| 2-3 | ICS 캘린더 내보내기 | ✅ | `src/lib/utils/ics.ts`, `CalendarExportButton.tsx` |
| 2-4 | 예산 관리 (예상 vs 실제) | ✅ | `src/app/api/v1/trips/[tripId]/expenses/`, `BudgetPanel.tsx` |
| 3-1 | 숙소 추천 | ✅ | `AccommodationCard.tsx` |
| 3-2 | 경로 최적화 (Greedy NN) | ✅ | `src/lib/utils/routeOptimizer.ts`, `optimize-route/route.ts` |
| 3-3 | 리마인더 설정 | ✅ | `ReminderToggle.tsx` (이메일 발송은 Edge Function 별도 필요) |
| 4-1 | Travel Room 실시간 동기화 | ✅ | `src/hooks/useRoomRealtime.ts` |
| 4-2 | Travel Room 투표 | ✅ | `VoteButton.tsx`, `src/app/api/v1/rooms/[roomId]/votes/` |
| 4-3 | Travel Room 채팅 | ✅ | `ChatPanel.tsx`, `src/hooks/useRoomChat.ts` |
| 4-4 | 마이페이지 강화 (이력+통계) | ✅ | `TripHistory.tsx`, `TravelStats.tsx` |
| 4-5 | 일정 별점 | ✅ | `src/app/api/v1/trips/[tripId]/ratings/` |
| 5-1 | PWA (오프라인 캐시) | ✅ | `public/manifest.json`, `public/sw.js` |
| 5-2 | 사진 갤러리 | ✅ | `PhotoGallery.tsx`, `src/app/api/v1/trips/[tripId]/photos/` |
| 신규 | 여행 완료(completed) 상태 | ✅ | TripDetailView.tsx, TripCard.tsx, `validators/tripItem.ts` |
| 신규 | 여행 중 "오늘" 하이라이트 | ✅ | DayColumn.tsx (📍 오늘 뱃지 + 자동 스크롤) |
| 신규 | 여행 후 일괄 평가 모달 | ✅ | `TripReviewModal.tsx` (별점 + 한줄 메모) |
| 신규 | 이전 여행 참조 AI | ✅ | `api/v1/trips/history/`, `prompt.ts` (만족도 기반 추천) |
| 신규 | 도시명 정규화 (30개 도시) | ✅ | `src/lib/utils/cityNormalize.ts` |
| 신규 | 대시보드 상대 날짜 | ✅ | TripCard.tsx (D-3, 여행 중, 다녀옴) |

### 🚫 API 비용 규칙 (필독)

```
⚠️ Gemini 3.1 Pro 사용 절대 금지 (출력 $12~18/1M → 30건 테스트로 5만원 발생)
⚠️ 코드에 안전장치 있음: "3.1-pro" 감지 시 자동으로 2.5-flash로 강제 전환

프로덕션 모델:
  GEMINI_PRO_MODEL=gemini-2.5-flash        ($0.30/$2.50 per 1M)
  GEMINI_FLASH_MODEL=gemini-2.5-flash-lite ($0.10/$0.40 per 1M)

테스트 시:
  SKIP_PLACES_VERIFY=true 필수 (Google Places 호출 차단)
  테스트용 모델: gemini-2.5-flash-lite 또는 gemini-3.1-flash-lite-preview (무료)

비용 기준:
  시나리오 1건 (Places 포함): ~$0.82
  시나리오 1건 (Places 스킵): ~$0.15
  시나리오 1건 (Flash-Lite + 스킵): ~$0.03
```

### ⚠️ 배포 전 필수 작업 (수동)

```
1. Supabase에서 7개 마이그레이션 실행 (순서대로):
   supabase/migrations/20260329000001_trip_checklists.sql
   supabase/migrations/20260329000002_trip_expenses.sql
   supabase/migrations/20260329000003_trip_notifications.sql
   supabase/migrations/20260329000004_room_votes.sql
   supabase/migrations/20260329000005_room_messages.sql
   supabase/migrations/20260329000006_trip_ratings.sql
   supabase/migrations/20260329000007_trip_photos.sql
   supabase/migrations/20260329000010_trip_completed_status.sql

2. Supabase Storage에 'trip-photos' 버킷 생성 (Private 권장)

3. 이메일 리마인더: Supabase Edge Functions + Resend 연동 별도 구현 필요

참고: 날씨(Open-Meteo)와 환율(open.er-api.com)은 API 키가 필요 없음 — 설정 없이 바로 동작
```

### 🆕 v2 AI 파이프라인 (2026-03-31 구현)

AI 일정 생성이 **하루 단위 생성 + 즉시 검증 + 부분 재생성** 구조로 변경됨.
상세: `docs/plans/v2-ai-architecture.md`

```
핵심 변경:
1. 모든 일수에서 날마다 Gemini 호출 → validateDay() 즉시 검증
2. 실패 시 repairDay() → Gemini에 부분 재요청 (비용 미미)
3. 그래도 실패 시 augmentMissingMeals() fallback
4. toTripItems()에서 필드 클램프 (시간/비용/좌표 범위 강제)

플랜별 기능 차등 (getPlanFeatures):
- Free: flash-lite, Places 스킵, Directions 스킵, repair 0회, 월 2회
- Pro: 2.5-flash, Places ✅, Directions ✅, repair 1회, 월 15회
- Team: 2.5-flash, Places ✅, Directions ✅, repair 2회, 무제한

신규 파일:
- src/lib/services/googleDirections.service.ts (실제 이동시간 계산)
- src/lib/services/ai/models.ts (모델 중앙 관리 + 가격표)
- src/lib/services/ai/testValidation.ts (20개 검증 규칙)
- src/lib/services/ai/seasonal-events.ts (계절 이벤트 DB)
```

### ⏳ 구현은 됐지만 세분화 필요한 것

- **요금제별 기능 제한**: `getPlanFeatures()`로 AI 기능 차등 구현 완료. 단, 비-AI 기능(PDF, Travel Room 등)은 아직 차등 없음. 수정 위치: 각 API route에 plan 체크 추가

### 미구현 (로드맵에 있지만 아직 안 한 것)

- **다국어 (i18n)**: next-intl 설치 + 전체 UI 텍스트 추출 필요 — 별도 스프린트
- **커뮤니티/리뷰**: /explore 페이지, public_trips, trip_reviews — 기획 필요

---

## 프로젝트 구조 (주요 디렉토리)

```
src/
├── app/
│   ├── api/v1/              ← API Routes (31개 엔드포인트)
│   │   ├── ai/              ← AI 생성 (generate, expand, popular-places, feasibility)
│   │   ├── trips/[tripId]/  ← 여행 CRUD + checklist, expenses, export, photos, ratings, reminder, optimize-route
│   │   ├── rooms/[roomId]/  ← Travel Room (generate, join, messages, votes)
│   │   ├── weather/         ← 실시간 날씨
│   │   ├── exchange/        ← 실시간 환율
│   │   ├── profile/         ← 사용자 프로필
│   │   └── admin/           ← 관리자 통계/사용자
│   ├── dashboard/           ← 메인 대시보드
│   ├── trips/[tripId]/      ← 여행 상세 페이지
│   ├── rooms/               ← Travel Room 페이지
│   ├── mypage/              ← 마이페이지 (프로필|이력|통계 탭)
│   ├── pricing/             ← 요금제 페이지
│   ├── auth/                ← 로그인/회원가입
│   ├── onboarding/          ← 프로필 온보딩
│   └── page.tsx             ← 랜딩 페이지 (애니메이션 웨이브 곡선)
├── components/features/
│   ├── trip-view/           ← 여행 상세 UI (18개 컴포넌트)
│   │   ├── TripDetailView.tsx  ← 메인 (탭: 일정|준비물|예산|사진)
│   │   ├── WeatherCard.tsx, ExchangeBadge.tsx, EmergencyInfo.tsx  ← Phase 1
│   │   ├── ChecklistPanel.tsx, BudgetPanel.tsx, PhotoGallery.tsx  ← Phase 2
│   │   ├── AccommodationCard.tsx, ReminderToggle.tsx              ← Phase 3
│   │   └── PrintButton.tsx, CalendarExportButton.tsx              ← 내보내기
│   ├── rooms/               ← ChatPanel.tsx, VoteButton.tsx
│   ├── mypage/              ← TripHistory.tsx, TravelStats.tsx
│   ├── map/                 ← MapView.tsx (Google Maps)
│   └── auth/, profile/, trip-creator/, trip-editor/
├── hooks/                   ← React Query 기반 (10개)
├── lib/
│   ├── services/            ← 비즈니스 로직
│   │   ├── ai.service.ts + ai/  ← AI 프로바이더 체인 (Gemini→Claude→OpenAI)
│   │   ├── weather.service.ts   ← OpenWeather API + 1시간 캐시
│   │   ├── exchange.service.ts  ← ExchangeRate API + 6시간 캐시 + fallback
│   │   ├── googlePlaces.service.ts  ← Google Places API
│   │   └── rateLimit.service.ts     ← 엔드포인트별 일일 한도
│   ├── data/                ← 정적 데이터 (emergency-contacts.ts)
│   └── utils/               ← ics.ts, routeOptimizer.ts
├── types/database.ts        ← 모든 DB 타입 정의
└── middleware.ts             ← 인증 보호 (protected routes + 리다이렉트)

supabase/migrations/          ← DB 마이그레이션 (전부 RLS 포함)
public/                       ← PWA (manifest.json, sw.js, 아이콘)
```

---

## 에이전트 하네스 (세션 간 연속성)

이 프로젝트는 **에이전트 하네스** 구조를 사용한다.
Claude 세션은 언제든 끊길 수 있다. 세션이 끊기면 컨텍스트가 전부 사라진다.
따라서 **작업 상태를 파일에 기록**해야 다음 세션에서 이어서 작업할 수 있다.

### 세션 시작 시 (반드시 먼저 실행)

```
1. 이 CLAUDE.md를 읽는다 (프로젝트 현재 상태 파악)
2. docs/tasks/active/ 폴더를 확인한다
3. 파일이 있으면 → 읽고 이어서 작업한다
4. 파일이 없으면 → 새 작업을 시작한다
```

### 작업 도중 (3개 이상 파일 변경 시)

작업 시작 **전에** 다음 3개 파일을 생성한다:

```
docs/tasks/active/{작업명}-plan.md        ← 뭘 왜 어떻게 하는지
docs/tasks/active/{작업명}-context.md     ← 발견한 사실, 결정 이유, 주의사항
docs/tasks/active/{작업명}-checklist.md   ← [ ] 할 일 목록
```

체크리스트는 **1~2개 완료할 때마다 즉시 업데이트**한다.

### 작업 완료 시

1. 체크리스트 전체 완료 확인
2. 코드 리뷰 + 보안 리뷰 수행 → 수정사항 반영
3. `docs/tasks/active/` → `docs/tasks/done/`으로 이동
4. **이 CLAUDE.md의 "프로젝트 현재 상태" 섹션 업데이트** ← 중요!

---

## 코드 패턴 & 컨벤션

### API Route 패턴
```typescript
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { AppError } from '@/lib/errors/appError';
import { handleApiError } from '@/lib/errors/handler';

export async function GET(request, { params }) {
  try {
    const { supabase, user } = await getAuthUser();
    const { tripId } = await params;
    // ... 로직
    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 보안 체크리스트 (새 엔드포인트 추가 시)
- [ ] `getAuthUser()` 인증 확인
- [ ] 소유권 확인 (trips → `user_id = auth.uid()`)
- [ ] 입력값 타입/길이/형식 검증
- [ ] `checkRateLimit(supabase, user.id, endpoint)` 추가
- [ ] RLS 정책이 있는 DB 마이그레이션 작성

### 디자인 시스템
- 기본 배경: `bg-[#f5f5f5]`, 카드: `bg-white rounded-2xl border border-black/5`
- 액센트: `orange-500`, 텍스트: `text-black`, 서브텍스트: `text-black/40`
- 로고: `font-serif italic "Tripplan"` (랜딩/요금제 자체 nav, 앱 내부는 Header.tsx)
- 랜딩/요금제에서 `<Header>` 자동 숨김 (`isLanding` 체크)

---

## 필수 규칙

1. **매뉴얼 선택적 로딩**: 작업 시작 전 `docs/manuals/_index.md`를 읽고, 필요한 매뉴얼"만" 로딩
2. **한 번에 1~2개 작업만 수행**: 체크리스트를 1~2개씩 완료 후 업데이트
3. **수정 보고 형식**:
   ```
   ### [수정 항목 제목]
   - **원인**: 왜 문제가 발생했는지
   - **해결**: 어떻게 해결했는지 (변경 파일 목록)
   - **결과**: 빌드/테스트 통과 여부
   ```

## 매뉴얼 빠른 참조

| 작업 상황 | 읽을 매뉴얼 |
|-----------|-------------|
| 백엔드/API 작업 | `docs/manuals/backend.md` |
| 프론트엔드 UI 작업 | `docs/manuals/frontend.md` |
| DB 스키마/쿼리 작업 | `docs/manuals/database.md` |
| 보안 관련 코드 | `docs/manuals/security.md` |
| 에러 처리 추가 | `docs/manuals/error-handling.md` |
| 변수/함수 이름 결정 | `docs/manuals/naming-conventions.md` |
| API 엔드포인트 설계 | `docs/manuals/api-design.md` |
| AI 엔드포인트/프로바이더 작업 | `docs/manuals/ai-gateway.md` |
| 기획/요구사항/MVP 범위 확인 | `docs/prd/tripplan-prd.md` |
| 전체 로드맵 확인 | `docs/roadmap.md` |
| 배포 가이드 | `docs/DEPLOY.md` |

## gstack 스킬 활용

gstack이 글로벌 설치되어 있으므로 (`~/.claude/skills/gstack/`) 다음 명령어를 적절한 시점에 사용할 것.

| 시점 | 명령 | 용도 |
|------|------|------|
| 기능 완성 후 | `/review` | 코드 리뷰 (SQL 안전성, 신뢰 경계) |
| 보안 관련 코드 후 | `/cso` | OWASP Top 10 + STRIDE 보안 감사 |
| UI 변경 후 | `/qa-only` | 헤드리스 브라우저 QA 리포트 |
| 디자인 변경 후 | `/design-review` | 시각적 QA + 자동 수정 |
| PR 생성 시 | `/ship` | 머지 → 테스트 → 버전 → CHANGELOG → PR |
| 배포 후 | `/canary` | 프로덕션 모니터링 |
| 디버깅 시 | `/investigate` | 체계적 근본 원인 분석 |
| 세션 마무리 | `/wrap-up` | 코드리뷰 + 보안리뷰 + 문서화 |

**자동 훅 (settings.local.json):**
- `.env`/락파일 수정 시 자동 차단 (PreToolUse)
- `.ts/.tsx` 수정 후 자동 tsc 타입체크 (PostToolUse)

---

## 완료된 작업 이력

과거 완료된 작업 상세 내역은 `docs/tasks/done/` 폴더 참조.
주요 완료 작업:
- MVP 핵심 기능 (AI 생성, 프로필, 대시보드)
- Gemini 2.5 Pro/Flash AI 프로바이더 전환
- 게이트웨이 504 타임아웃 수정 (프롬프트 분할 + 재시도)
- Google Places RAG 연동
- 관리자 시스템
- 보안 수정 (XSS, 인젝션, RLS)
- UI 리디자인 (랜딩, 달력, 요금제)
- Phase 1~5 전체 기능 구현 (2026-03-29 완료)
