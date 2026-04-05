# 매뉴얼 아키텍처 재정렬 체크리스트

> 작성일: 2026-03-09
> 관련 계획서: `./plan-architecture-realign.md`
> 진행률: 0/11 완료

## 현재 진행 상태

**현재 작업 중:** 완료
**마지막 완료:** Phase 3
**다음 작업:** 검증

---

## 작업 항목

### Phase 1: 매뉴얼 아키텍처 재작성
- [x] 1.1 backend.md 전면 재작성 (Next.js Route Handler + Supabase)
- [x] 1.2 frontend.md 구조 재매핑 (App Router)
- [x] 1.3 security.md 인증 섹션 Supabase Auth로 수정
- [x] 1.4 _index.md 경로 패턴 업데이트
- [x] 1.5 api-design.md Route Handler 매핑 추가

### Phase 2: 누락 가이드 보강
- [x] 2.1 PRD 의존성 목록 구체화
- [x] 2.2 Mock Data 전략 추가 (frontend.md에 포함)

### Phase 3: 프로젝트 부트스트랩
- [x] 3.1 1차 커밋 (수정된 매뉴얼)
- [x] 3.2 Next.js 프로젝트 초기화 + 추가 설정
- [x] 3.3 디렉토리 뼈대 + 환경 설정 + .gitignore
- [x] 3.4 Supabase CLI 초기화 + 2차 커밋

---

## 완료 후 검증
- [ ] 매뉴얼 디렉토리 구조 = create-next-app 결과
- [ ] security.md에 JWT/bcrypt 충돌 내용 없음
- [ ] _index.md 경로 패턴 = 실제 구조
- [ ] npm run build 성공
- [ ] npm run lint 성공

---

## 작업 로그 (최신순)

| 시각 | 완료 항목 | 비고 |
|------|-----------|------|
