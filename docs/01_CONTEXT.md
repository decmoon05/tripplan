# TripWise — 맥락 노트 (시방서)

> 이 문서는 "왜 이렇게 결정했는지"를 기록합니다.
> 나중에 돌아봤을 때 의사결정의 맥락을 이해할 수 있게 합니다.

---

## 기술 결정 기록

### 2026-03-02 | 초기 스택 선택

**결정**: React Native (Expo) + Node.js/TypeScript + Claude API

**이유**:
- React Native: 1인 개발로 iOS/Android/웹 동시 대응. Expo로 빌드 복잡도 낮춤.
- Node.js/TypeScript: 프론트와 언어 통일(JS). TypeScript strict로 초보자 실수 방지.
- Claude API: 개인화 추천의 핵심. 웹 검색 기능(실시간 이슈 체크)이 필요해 선택.

**고려했던 대안**:
- Flutter: Dart 언어 추가 학습 필요해 제외.
- Python FastAPI: AI/ML에 강하지만 프론트와 언어 분리돼 복잡도 증가.

---

### 2026-03-02 | 모노레포 구조 선택

**결정**: `apps/`, `packages/` 구조

**이유**:
- 백엔드와 프론트 타입 공유 (shared 패키지).
- 나중에 웹 버전 추가 시 구조 유지.
- 지금은 패키지 2개(mobile + api)만 실제로 만들면 됨.

---

### 2026-03-02 | Phase 1 범위 결정

**결정**: 항공권/숙소 예약 연동, 재정 바구니를 Phase 2로 미룸.

**이유**:
- 항공권 API (Skyscanner, Kayak) 접근이 파트너십 필요 → 초기 불가.
- 핵심 차별화는 "AI 개인화 추천". 예약 기능 없이도 가치 검증 가능.
- 범위를 줄여야 6개월 내 MVP 완성 가능.

---

### 2026-03-02 | 성격 프로파일링 방식 결정

**결정**: 고정 질문 12개 + AI 보충 질문 2~4개

**이유**:
- 완전 채팅형: 편의성은 좋지만 데이터 구조화가 어려움.
- 완전 설문형: 구조화는 쉽지만 모든 경우를 커버 불가.
- 혼합형: 고정으로 기본 프로파일 잡고, AI가 빈 부분 보충 질문.

**주의사항**: 질문은 이분법적이면 안 됨. 예/아니오/상관없음/때에따라/직접입력 5가지 옵션.

---

## 외부 API 및 서비스

| 서비스 | 용도 | 비용 주의사항 |
|--------|------|--------------|
| Anthropic Claude API | AI 추천, 이슈 체크 | 토큰당 과금. 캐싱 필수. |
| Google Places API | 장소 기본 정보 | 월 200달러 무료 크레딧 후 유료 |
| Google Maps Directions | 이동 시간 계산 | 요청당 과금 |

---

## 알려진 기술적 도전

1. **층수 정보**: Google Places에 없음. AI 웹검색으로 보완 예정.
2. **즉흥 변경**: 현위치 기반 실시간 추천 → Phase 2로 연기.
3. **개인정보**: 성향 데이터 민감 → 프라이버시 모드 설계 필요 (Phase 1 포함).
4. **AI 비용**: 사용자 증가 시 Claude API 비용 급증 → 캐싱 전략 중요.

---

## 참고 자료

- Claude API 공식 문서: https://docs.anthropic.com
- Expo 공식 문서: https://docs.expo.dev
- Google Places API: https://developers.google.com/maps/documentation/places
- Prisma 공식 문서: https://www.prisma.io/docs
