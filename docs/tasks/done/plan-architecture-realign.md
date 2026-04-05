# 매뉴얼 아키텍처 재정렬 + 프로젝트 부트스트랩 계획서

> 작성일: 2026-03-09
> 상태: 진행중
> 관련 체크리스트: `./checklist-architecture-realign.md`
> 관련 맥락 노트: `./context-architecture-realign.md`

## 1. 목표

- 매뉴얼이 Express 4계층 구조로 작성된 것을 Next.js App Router + Supabase 구조로 재정렬
- 코드 0줄인 지금 매뉴얼-실제 기술 스택 불일치를 해소
- Next.js 프로젝트 부트스트랩 완료

## 2. 범위

### 포함
- Phase 1: 매뉴얼 5개 파일 재작성 (backend, frontend, security, _index, api-design)
- Phase 2: PRD 의존성 보강, Mock Data 전략 추가
- Phase 3: Next.js 프로젝트 초기화 + 디렉토리 뼈대 + 환경 설정

### 제외
- 실제 기능 코드 작성 (부트스트랩만)
- Supabase 원격 프로젝트 생성

## 3. 기술 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 서버 구조 | Route Handler → Service → Supabase Client | Next.js + Supabase에 자연스러운 2~3계층 |
| 인증 | Supabase Auth + @supabase/ssr | JWT/bcrypt 직접 구현 불필요 |
| 상태 관리 | Zustand (클라이언트) + TanStack Query (서버) | 경량 + 캐싱 자동화 |
| 입력 검증 | Zod | TypeScript 친화적 |
| 테스트 | Vitest + React Testing Library | Next.js와 호환성 좋음 |

## 4. 파일 구조 (신규/수정 예정)

```
수정: docs/manuals/backend.md (전면 재작성)
수정: docs/manuals/frontend.md (구조 재매핑)
수정: docs/manuals/security.md (인증 섹션)
수정: docs/manuals/_index.md (경로 패턴)
수정: docs/manuals/api-design.md (Route Handler 매핑)
수정: docs/prd/tripplan-prd.md (의존성 구체화)
신규: Next.js 프로젝트 파일 전체
```

## 5. 단계별 작업

1. [x] Phase 1: 매뉴얼 아키텍처 재작성 (5파일)
2. [ ] Phase 2: 누락 가이드 보강 (PRD + Mock)
3. [ ] Phase 3: 프로젝트 부트스트랩

## 6. 검증 기준

- 매뉴얼 디렉토리 구조가 create-next-app 결과와 일치
- security.md에 JWT 직접 발급/bcrypt 충돌 내용 없음
- _index.md 경로 패턴이 실제 파일 구조와 매칭
- npm run build / npm run lint 성공
