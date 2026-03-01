# AI 여행 앱 (TripWise) — 프로젝트 규칙

> 이 파일은 Claude Code가 매 작업 시작 시 반드시 읽는 핵심 지침서입니다.
> 작업 전 이 파일을 읽고, 해당하는 챕터의 매뉴얼도 확인하세요.

---

## 1. 프로젝트 개요

**제품명**: TripWise (가칭)
**목적**: AI 기반 개인화 여행 앱. 성격·취향·동행 유형에 맞는 여행 추천 및 즉흥 변경 지원.
**대상**: 기존 여행 앱의 불편함(획일적 추천, 낮은 UI 정보량, 즉흥 변경 불가)을 해결.
**스택**: React Native (Expo) + Node.js/TypeScript + Claude API
**플랫폼**: 웹 + iOS + Android (단계적 출시)

자세한 기획: `docs/00_PROJECT_PLAN.md`
기술 결정 맥락: `docs/01_CONTEXT.md`
현재 진행 상황: `docs/02_TODO.md`

---

## 2. 매뉴얼 목차 (필요 챕터만 읽을 것)

| 작업 유형 | 읽어야 할 매뉴얼 |
|-----------|-----------------|
| 백엔드/API/서버/DB | `docs/manuals/BACKEND_MANUAL.md` |
| 프론트엔드/화면/컴포넌트 | `docs/manuals/FRONTEND_MANUAL.md` |
| AI 통합/추천/LLM | `docs/manuals/AI_INTEGRATION_MANUAL.md` |
| 새 기능 추가 전 | `docs/00_PROJECT_PLAN.md` Phase 확인 |

---

## 3. 절대 규칙 (위반 금지)

### 3-1. 작업 방식
- **한 번에 1~2개 작업만** 진행. 계획 승인 후 순차 실행.
- 작업 전 `docs/02_TODO.md` 확인. 완료 후 업데이트.
- 큰 작업(새 기능, 구조 변경)은 반드시 계획서 먼저 작성 후 승인받을 것.
- 코드 작성 전 관련 파일을 읽고 기존 패턴을 파악할 것.

### 3-2. 코드 품질
- TypeScript strict 모드 사용. `any` 타입 사용 금지.
- 모든 API 호출은 try-catch로 감싸고 에러를 명확히 처리.
- 환경변수(API 키, DB 비밀번호)는 절대 코드에 직접 작성 금지. `.env` 사용.
- `.env` 파일은 절대 커밋 금지. `.gitignore`에 포함 확인.
- 함수 하나는 한 가지 역할만. 100줄 넘으면 분리 고려.

### 3-3. 보안
- 사용자 입력은 항상 검증 (SQL Injection, XSS 방지).
- Claude API 키는 반드시 서버 사이드에서만 사용. 클라이언트 노출 절대 금지.
- 개인정보(여행 성향, 취향 데이터)는 최소 수집 원칙.
- 개인정보 관련 기능 구현 시 프라이버시 모드 고려.

### 3-4. 과잉 개발 금지
- 요청하지 않은 기능 추가 금지.
- 현재 Phase에 없는 기능은 TODO에 기록만 하고 구현하지 말 것.
- Phase 1 완성 전 Phase 2 기능 구현 금지.

---

## 4. 기술 스택 & 아키텍처

```
TripWise/
├── apps/
│   ├── mobile/          # React Native (Expo) - 모바일 앱
│   └── web/             # Next.js - 웹 버전 (Phase 2)
├── packages/
│   ├── api/             # Node.js/TypeScript 백엔드
│   ├── shared/          # 공유 타입, 유틸리티
│   └── ai/              # AI 통합 레이어
├── docs/                # 기획·맥락·할일 문서
└── CLAUDE.md            # 이 파일
```

**모노레포 구조**: Turborepo 또는 npm workspaces 사용.
**API 통신**: REST (Phase 1). GraphQL 도입 시 맥락 노트에 기록.
**DB**: PostgreSQL + Prisma ORM.
**캐시**: Redis (여행지 정보, AI 응답 캐싱).

---

## 5. Phase 1 범위 (현재 집중할 것)

MVP에서 구현할 기능만:
1. 사용자 성격 프로파일링 (고정 질문 + AI 추가 질문)
2. 여행 목적지 선택
3. AI 기반 일정 초안 생성 (동선 최적화)
4. 여행지 정보 카드 (Google Places 기반)
5. 여행 전 실시간 이슈 체크 (공사, 공휴일, 이벤트)

**Phase 1에 없는 것**: 항공권/숙소 예약 연동, 재정 바구니, 커뮤니티 기능.

---

## 6. 작업 완료 체크리스트

작업을 마쳤다고 보고하기 전에 스스로 확인:
- [ ] TypeScript 타입 에러 없음
- [ ] API 호출에 에러 처리 있음
- [ ] 환경변수 노출 없음
- [ ] 기존 코드 스타일과 일관성 유지
- [ ] `docs/02_TODO.md` 업데이트 완료
- [ ] 요청하지 않은 기능 추가하지 않음
