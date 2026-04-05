# 게이트웨이 504 타임아웃 수정 체크리스트

> 작성일: 2026-03-18
> 관련 계획서: `./plan-gateway-timeout-fix.md`
> 진행률: 4/4 완료

## 현재 진행 상태

**현재 작업 중:** (없음 — 완료)
**마지막 완료:** 빌드 검증
**다음 작업:** 없음

---

## 작업 항목

### Phase 1: 프롬프트 분할
- [x] 1.1 `prompt.ts`에 `buildSingleDayUserPrompt()` 함수 추가
- [x] 1.2 압축 프롬프트: 전체 대비 ~60% 축소, previousPlaces로 중복 방지

### Phase 2: Provider 수정
- [x] 2.1 `openai.provider.ts` — callOpenAI() 공통 함수 추출
- [x] 2.2 `openai.provider.ts` — 게이트웨이+다일 분할 요청 로직
- [x] 2.3 `claude.provider.ts` — max_tokens 4000→8000

### Phase 3: 검증
- [x] 3.1 `tsc --noEmit` 통과
- [x] 3.2 `next build` 통과
- [ ] 3.3 실제 게이트웨이 테스트 (사용자 수동 확인 필요)

---

## 완료 후 검증
- [x] 타입 체크 통과
- [x] 빌드 통과
- [ ] 실제 API 테스트 (사용자 확인)

---

## 작업 로그 (최신순)

| 시각 | 완료 항목 | 비고 |
|------|-----------|------|
| 2026-03-18 | v1: 분할 요청 구현 | Day 1,2 성공 / Day 3 504 |
| 2026-03-18 | v2: 토큰 최적화 + 재시도 | max_tokens 8000→4000, 압축 시스템 프롬프트, 1회 재시도, 부분 성공 반환, timeout 55초 |
