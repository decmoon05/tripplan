# Gemini 대화 검토 수정 반영 계획서

> 작성일: 2026-03-08
> 상태: 진행중
> 관련 체크리스트: `./checklist-gemini-review-fixes.md`
> 관련 맥락 노트: `./context-gemini-review-fixes.md`

## 1. 목표

- Gemini와의 사업 기획 대화에서 발견된 기술적 오류, 법적 리스크, 누락 사항을 프로젝트 가이드 문서에 반영
- PRD(Product Requirements Document) 생성하여 올바른 기술/사업 방향 문서화

## 2. 범위

### 포함
- Google Places API 캐싱 정책 가이드라인 (ToS 준수)
- PG사 결제 연동 가능성 문서화
- 사업자 등록 법적 검토 사항 정리
- API 비용 모델링 문서 생성
- 개인정보보호법 대응 가이드라인
- PWA vs 네이티브 트레이드오프 문서화
- price_level 한계 및 대안 접근법
- 위치기반서비스사업자 신고 요건

### 제외
- 실제 코드 구현 (문서 정비 단계)
- 사업자 등록 실행 (법률 상담 필요)
- PG사 계약 (MVP 이후)

## 3. 기술 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 장소 데이터 저장 | place_id만 저장 | Google ToS 준수 |
| 결제 연동 | PG사 이용 (토스페이먼츠 등) | 사업자등록증만으로 가능 |
| 비용 추정 | AI 리뷰 텍스트 분석 | price_level은 상대적 값이라 부정확 |

## 4. 파일 구조 (신규/수정 예정)

```
docs/
├── 신규: prd/
│   ├── tripplan-prd.md                # 제품 요구사항 문서
│   ├── api-cost-model.md              # API 비용 모델링
│   ├── legal-compliance.md            # 법적 준수 사항
│   └── pwa-native-tradeoff.md         # PWA vs 네이티브 비교
├── 수정: manuals/
│   ├── backend.md                     # Google API 캐싱 정책 추가
│   ├── database.md                    # place_id만 저장 규칙 추가
│   └── security.md                    # 개인정보보호법 대응 추가
```

## 5. 단계별 작업

1. [ ] Phase 1: PRD 핵심 문서 생성 (tripplan-prd.md, api-cost-model.md)
2. [ ] Phase 2: 법적 준수 문서 생성 (legal-compliance.md)
3. [ ] Phase 3: 기술 트레이드오프 문서 (pwa-native-tradeoff.md)
4. [ ] Phase 4: 기존 매뉴얼 수정 (backend.md, database.md, security.md)

## 6. 의존성 및 선행 조건

- 없음 (문서 작업)

## 7. 검증 기준

- 10개 검토 항목이 모두 적절한 문서에 반영됨
- Google Places ToS 위반 가능성 제거
- API 비용 모델링으로 수익성 판단 가능
