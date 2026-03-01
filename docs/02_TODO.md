# TripWise — 할 일 체크리스트 (공정표)

> 이 파일은 항상 최신 상태로 유지할 것.
> 작업 완료 시 [x] 표시. 새 작업 발견 시 바로 추가.

---

## 현재 상태: 🔧 시스템 구축 완료, 개발 환경 세팅 필요

---

## Phase 0 — 개발 환경 세팅

- [ ] Node.js 설치 확인 (v18+)
- [ ] Expo CLI 설치
- [ ] PostgreSQL 설치 또는 Supabase 클라우드 세팅
- [ ] Redis 설치 또는 Upstash 클라우드 세팅
- [ ] Anthropic API 키 발급
- [ ] Google Places API 키 발급
- [ ] 모노레포 초기 구조 생성 (package.json, apps/, packages/)
- [ ] .env.example 파일 생성
- [ ] .gitignore 설정

---

## Phase 1 — MVP

### 백엔드

#### 1. 기초 세팅
- [ ] Express + TypeScript 프로젝트 초기화
- [ ] Prisma 설정 + 초기 스키마 작성
- [ ] JWT 인증 미들웨어
- [ ] 에러 핸들러 미들웨어
- [ ] 환경변수 로더 설정

#### 2. 사용자/프로파일 API
- [ ] POST /api/v1/auth/register
- [ ] POST /api/v1/auth/login
- [ ] GET/PUT /api/v1/profile
- [ ] POST /api/v1/profile/questions (프로파일링 질문 목록 반환)
- [ ] POST /api/v1/profile/complete (답변 저장 + AI 추가 질문 생성)

#### 3. 여행 API
- [ ] POST /api/v1/trips (목적지+날짜+동행 입력, AI 일정 생성 트리거)
- [ ] GET /api/v1/trips (내 여행 목록)
- [ ] GET /api/v1/trips/:id (일정 상세)
- [ ] PATCH /api/v1/trips/:id/places (일정 수정)

#### 4. 장소 API
- [ ] GET /api/v1/places/:id (Google Places + 캐시 레이어)
- [ ] GET /api/v1/places/search (검색)

#### 5. AI 통합
- [ ] Claude API 클라이언트 모듈
- [ ] 프로파일 기반 일정 생성 서비스
- [ ] 실시간 이슈 체크 서비스
- [ ] AI 응답 캐싱 레이어

### 프론트엔드 (React Native)

#### 1. 기초 세팅
- [ ] Expo 프로젝트 초기화
- [ ] Expo Router 설정
- [ ] NativeWind 또는 스타일 시스템 설정
- [ ] React Query + Zustand 설치
- [ ] API 서비스 레이어 (axios + 인터셉터)

#### 2. 인증 화면
- [ ] 회원가입 화면
- [ ] 로그인 화면
- [ ] 토큰 자동 갱신

#### 3. 온보딩/프로파일링
- [ ] 질문 카드 컴포넌트
- [ ] 5가지 답변 옵션 UI (예/아니오/상관없음/때에따라/직접입력)
- [ ] AI 보충 질문 처리
- [ ] 프로파일 완성 화면

#### 4. 홈 화면
- [ ] 프로파일 요약 카드
- [ ] 새 여행 시작 버튼
- [ ] 이전 여행 목록

#### 5. 목적지 선택
- [ ] 검색바 + 자동완성
- [ ] 인기 목적지 그리드
- [ ] 날짜 선택 (DatePicker)
- [ ] 동행 유형 선택

#### 6. 일정 화면 (핵심)
- [ ] 날짜별 탭
- [ ] 여행지 카드 컴포넌트 (간결 기본 + 상세 펼치기)
- [ ] 카드 드래그 순서 변경
- [ ] 지도 뷰 토글 (Google Maps)
- [ ] 이슈 경고 배너

---

## Phase 2 — (나중에)

- [ ] 재정 바구니
- [ ] 즉흥 변경 모드
- [ ] 취미 매칭 확장
- [ ] 나이대별 소셜 추천

---

## 발견된 이슈 / 메모

- (작업 중 발견한 문제나 질문을 여기에 기록)
