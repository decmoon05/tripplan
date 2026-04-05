# Google Places Hybrid RAG — 할루시네이션 방지

## 개요
AI(gpt-5-mini) 일정 생성 시 가상 가게 문제 해결.
Google Places API로 실제 장소를 미리 수집 → AI에 제공 → AI는 배치만 담당 → 나머지만 사후 검증.

## 전체 흐름
1. 목적지 선택 시 Google Places API로 실제 장소 수집 (캐싱 14일)
2. AI 프롬프트에 "이 검증된 장소에서 골라라" 주입
3. AI가 일정 생성 (배치/시간/이동정보/노트)
4. AI가 추가한 미검증 장소만 Google Places로 사후 검증
5. 검증 결과를 verified 플래그로 UI에 표시

## 구현 순서 (10단계)
| 순서 | 내용 | 파일 |
|------|------|------|
| 1 | DB 마이그레이션 | migration x2, combined |
| 2 | 타입 + 스키마 | database.ts, types.ts, parseResponse.ts |
| 3 | Google Places 서비스 | googlePlaces.service.ts |
| 4 | popularPlaces 수정 + API route | popularPlaces.ts, route.ts |
| 5 | 프롬프트 주입 | prompt.ts |
| 6 | 프로바이더 수정 | openai/claude/ai.service |
| 7 | 사후 검증 | postValidate.ts |
| 8 | 오케스트레이션 | trip.service.ts |
| 9 | UI | TimelineCard, PlaceExperienceCards |
| 10 | 빌드 검증 | npx next build |

## 참고: DB 매뉴얼 충돌
database.md에 "Google Places API 데이터 캐싱 금지" 규칙이 있으나, 사용자 요구에 따라 place_cache 테이블 생성 진행.
