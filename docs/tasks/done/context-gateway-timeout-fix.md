# 게이트웨이 504 타임아웃 수정 맥락 노트

> 작성일: 2026-03-18
> 관련 계획서: `./plan-gateway-timeout-fix.md`

## 1. 왜 이렇게 결정했는가

| 결정 사항 | 선택지 | 최종 선택 | 이유 |
|-----------|--------|-----------|------|
| 타임아웃 해결 | 프롬프트 축소 vs 분할 요청 vs max_tokens 감소 | 분할 요청 | reasoning 모델은 프롬프트 길이와 무관하게 reasoning_tokens을 많이 사용. 출력 크기를 줄이는 게 핵심 |
| 분할 단위 | 1일 vs 2일 | 1일 | 인기 장소 API(~6-8개 아이템)가 15-54초 걸림. 1일(3-5개)이면 30초 이내 안전 |
| 중복 방지 | 없음 vs previousPlaces 전달 | previousPlaces | 각 날짜별 요청이 독립적이면 같은 장소 반복 추천 가능 |

## 2. 제약 조건

- **기술적**: mindlogic.ai Cloudflare 60초 타임아웃 (변경 불가)
- **기술적**: gpt-5-mini는 reasoning 모델 → reasoning_tokens이 content 생성 전에 대량 소비
- **비용**: 분할 요청은 API 호출 횟수 증가 (3일=3회), 하지만 총 token은 비슷

## 3. 참고 자료 위치

| 자료 | 위치 |
|------|------|
| 게이트웨이 호환성 | `src/lib/services/ai/prompt.ts` — isGatewayMode() |
| AI Provider 패턴 | `src/lib/services/ai/openai.provider.ts` |
| 인기 장소 (성공 사례) | `src/lib/services/ai/popularPlaces.ts` — 8000 토큰으로 성공 |

## 4. 주의 사항 및 함정

- 분할 요청 시 각 날짜의 dayNumber가 올바르게 설정되어야 함 → 프롬프트에 `Set all dayNumber to ${dayNumber}` 명시
- previousPlaces가 너무 길어지면 프롬프트 길이 증가 → 현재 3-5일 여행 기준으로는 문제없음
- 직접 API 전환 시 분할 로직은 자동으로 비활성화 (isGatewayMode()=false)

## 5. 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|-----------|------|
| 2026-03-18 | 초기 작성 + 구현 완료 | 504 타임아웃 해결 |
