# 매뉴얼 아키텍처 재정렬 맥락 노트

> 작성일: 2026-03-09
> 관련 계획서: `./plan-architecture-realign.md`

## 1. 왜 이렇게 결정했는가

| 결정 사항 | 선택지 | 최종 선택 | 이유 |
|-----------|--------|-----------|------|
| 서버 계층 | 4계층(Express) vs 2~3계층 | 2~3계층 | Next.js는 파일시스템 라우팅, Supabase가 데이터 접근 담당 |
| 인증 방식 | JWT 직접 vs Supabase Auth | Supabase Auth | BaaS 선택의 핵심 이점, 이중 구현은 위험 |
| Repository 패턴 | 유지 vs 제거 | 제거 | Supabase Client가 타입 안전한 쿼리 빌더 제공 |
| 의존성 주입 | 생성자 DI vs 모듈 import | 모듈 import | Next.js 생태계 표준 |

## 2. 제약 조건

- 기술적: Next.js App Router는 파일 시스템 라우팅 강제
- 기술적: Supabase Auth는 자체 JWT 관리, 커스텀 JWT 불필요

## 3. 참고 자료 위치

| 자료 | 위치 |
|------|------|
| PRD | `docs/prd/tripplan-prd.md` |
| 백엔드 매뉴얼 | `docs/manuals/backend.md` |
| 보안 매뉴얼 | `docs/manuals/security.md` |

## 4. 주의 사항

- 외부 API 연동 섹션(Google Places, PG사 등)은 잘 작성되어 있으므로 유지
- 개인정보보호법, 위치기반서비스 신고 등 법률 섹션은 그대로 유지
- Page/Feature/UI 컴포넌트 분류도 잘 설계되어 있으므로 유지
