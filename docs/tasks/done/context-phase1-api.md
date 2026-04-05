# Phase 1 API 통합 — 컨텍스트 노트

> 작성일: 2026-03-29

## 구현 결정 사항

### OpenWeather API 키 URL 파라미터 사용
- OpenWeather는 Authorization 헤더를 지원하지 않음 (API 설계 제한)
- **서버 API Route에서만 호출** → 클라이언트에 키 노출 없음
- 보안 리뷰에서 CRITICAL로 분류됐지만, 서버사이드 전용이므로 실제 위험 낮음
- 코드에 주석으로 명시

### ai.service.ts 하드코딩 환율 유지
- AI 여행 생성 시 비용 추정에만 사용 (정확도보다 성능 우선)
- 실시간 환율 추가 시 AI 생성 지연 증가 우려
- 대신 TripDetailView에서 실시간 환율 별도 표시

### 인메모리 캐시 선택 이유
- Redis/Upstash 추가 시 비용 발생 + 복잡도 증가
- 서버리스 재시작 시 초기화 허용 (날씨/환율은 재조회해도 무방)
- 캐시 실패 시 fallback 있으므로 안전

### 레이트 리밋 기존 시스템 재사용
- `rateLimit.service.ts`에 weather/exchange 엔드포인트 추가
- 날씨 20회/일, 환율 20회/일 (1시간/6시간 캐시로 실제 API 호출은 훨씬 적음)

## 주의사항

1. `OPENWEATHER_API_KEY` 환경변수 없으면 날씨 카드가 안 보임 (에러 없음)
2. 환율은 API 키 불필요 (open.er-api.com 무료)
3. 비상 연락처는 정적 데이터 — 주기적 업데이트 필요 (6개월~1년)

## 알려진 한계

- 날씨 예보는 현재 기준 5일만 가능 (OpenWeather 무료 플랜)
- 미래 여행 날짜 날씨는 부정확할 수 있음
- 환율은 참고용 (실제 은행 환율과 다를 수 있음) → ExchangeBadge에 명시
