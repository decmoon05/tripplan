# 매뉴얼 라우팅 인덱스

> **이 파일의 목적**: AI가 모든 매뉴얼을 읽지 않고, 현재 작업에 필요한 매뉴얼만 선택적으로 로딩하기 위한 라우팅 테이블.
> 아래 조건에 해당하는 매뉴얼만 읽을 것. 해당 없는 매뉴얼은 절대 열지 말 것.

---

## 조건 1: 키워드 매칭

사용자 지시문에 아래 키워드가 포함되면 해당 매뉴얼을 로딩한다.

| 키워드 | 매뉴얼 파일 |
|--------|-------------|
| 백엔드, 서버, API, 라우트 핸들러, 미들웨어, Service | `backend.md` |
| 프론트엔드, UI, 컴포넌트, 페이지, 화면, 스타일 | `frontend.md` |
| DB, 데이터베이스, 스키마, 쿼리, 테이블, 마이그레이션 | `database.md` |
| 보안, 인증, 인가, 토큰, 암호화, XSS, CSRF, 권한 | `security.md` |
| 에러, 예외, try, catch, 에러 처리, 실패, 오류 | `error-handling.md` |
| AI, 게이트웨이, 타임아웃, OpenAI, Claude, provider, 504 | `ai-gateway.md` |
| 이름, 네이밍, 변수명, 함수명, 클래스명, 파일명 | `naming-conventions.md` |
| 엔드포인트, REST, 요청, 응답, 상태코드, 라우트 설계 | `api-design.md` |
| PRD, 요구사항, 기획, MVP, 비용, 법적, 수익, 결제 | `../prd/tripplan-prd.md` |

## 조건 2: 의도 파악

사용자의 작업 의도에 따라 추가로 로딩할 매뉴얼이 있다.

| 작업 의도 | 추가 로딩 매뉴얼 |
|-----------|------------------|
| 새 기능 추가 | `naming-conventions.md` + 해당 도메인 매뉴얼 |
| 버그 수정 | `error-handling.md` |
| 리팩터링 | `naming-conventions.md` |
| API 신규 생성 | `api-design.md` + `backend.md` + `error-handling.md` |
| AI 엔드포인트 추가 | `ai-gateway.md` + `backend.md` |
| 인증/인가 구현 | `security.md` + `backend.md` |
| DB 변경 | `database.md` + `backend.md` |
| 새 기능 기획/범위 확인 | `../prd/tripplan-prd.md` |

## 조건 3: 작업 위치 (파일/폴더 경로)

수정하는 파일의 경로에 따라 자동으로 매뉴얼을 로딩한다.

| 경로 패턴 | 매뉴얼 파일 |
|-----------|-------------|
| `src/app/api/**`, `src/lib/**`, `src/middleware.ts` | `backend.md` |
| `src/app/**` (api 제외), `src/components/**`, `src/hooks/**`, `src/stores/**` | `frontend.md` |
| `**/migrations/**`, `**/schema/**`, `**/models/**` | `database.md` |
| `src/lib/services/ai/**` | `ai-gateway.md` |
| `**/auth/**`, `**/middleware/auth**` | `security.md` |

## 조건 4: 파일 내용 패턴

수정 대상 파일에 아래 패턴이 존재하면 해당 매뉴얼을 참조한다.

| 파일 내 패턴 | 매뉴얼 파일 |
|-------------|-------------|
| `.sql`, SQL 쿼리문 | `database.md` |
| `supabase.auth`, `getUser`, `getSession`, `RLS`, `token` | `security.md` |
| `try/catch`, `throw`, `Error` 클래스 | `error-handling.md` |
| `export async function GET`, `export async function POST`, `NextRequest`, `NextResponse` | `api-design.md` + `backend.md` |

---

## 매뉴얼 파일 요약 (열기 전 참고용)

| 파일 | 줄 수(약) | 핵심 내용 |
|------|-----------|-----------|
| `backend.md` | ~160 | Route Handler + Service + Supabase 구조, 미들웨어, 외부 API 연동 |
| `frontend.md` | ~120 | App Router 구조, 서버/클라이언트 컴포넌트, 상태 관리, Mock Data 전략 |
| `database.md` | ~83 | 스키마 설계, 쿼리 작성, 마이그레이션 규칙 |
| `security.md` | ~72 | 인증/인가, 입력 검증, 취약점 방지, 개인정보보호법 |
| `error-handling.md` | ~79 | 에러 계층, 응답 형식, 로깅 규칙, 외부 API 에러 처리 |
| `naming-conventions.md` | ~43 | 파일명/변수명/함수명/클래스명 규칙 |
| `ai-gateway.md` | ~80 | 게이트웨이 3대 제약, 타임아웃 정책, 분할 요청, 체크리스트 |
| `api-design.md` | ~105 | 엔드포인트 설계, 상태코드, 버전 관리, 비용 최적화 |
| `../prd/tripplan-prd.md` | ~198 | 제품 요구사항, 기술 스택, MVP 단계, 데이터 모델, 리스크 |
