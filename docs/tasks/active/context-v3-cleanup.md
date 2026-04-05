# v3 정리 컨텍스트

## 발견한 사실

1. pipelineV3.ts line 118-119에서 v2 함수(validateClosedDays, validateGeoBoundary)가 v3 결과를 덮어씀
2. 제주 시나리오: 327km 좌표 + 1005분 이동시간 → 데이터 인프라(Nominatim) 제주 커버리지 부족
3. sortDayItems에서 오후 관광 3개 제한 + 저녁 중간 배치 → 관광지 제한은 사용자 가치 훼손
4. timeCalculator의 18:00 강제 → 사용자가 "22시 저녁" 원하면 대응 불가
5. 검증 22개 중 품질 관련은 2개뿐 (content_diversity, daily_travel_time) — 부족

## 규칙 (사용자 피드백)

- 묻지 말고 진행해라
- 최신 정보 항상 검색해서 확인
- 객관적으로 답변, 단점 숨기지 마라
- 관광지 수를 코드로 제한하지 마라 — 사용자 가치 훼손
- 사용자 요청(22시 저녁 등)을 코드가 무시하면 안 된다
- 비용 계산은 정확하게 — 옛날 정보 사용 금지

## 현재 .env.local 키 상태

- GEMINI_API_KEY: AIzaSyDAhAo1mONuMhyUeCmaZRHXSX0jN_5cM-g (유료)
- GEMINI_PRO_MODEL: gemini-3-flash-preview
- GEOAPIFY_API_KEY: b6a60c34b4084ca5ba0402927afdb531
- PIPELINE_VERSION: v3
- AI_PROVIDER: gemini
- 2.5-pro, 3.1-pro 사용 금지 (models.ts 안전장치)

## 비용 정보 (2026.04 검색 확인)

- Gemini 3-flash: $0.50/$3.00 per 1M
- Places Essentials: $0.005/건, 10,000/월 무료
- Places Pro: $0.032/건, 5,000/월 무료 (rating/hours/photos 포함 시)
- Places Enterprise: $0.035/건, 1,000/월 무료 (reviews 포함 시)
- 현재 FieldMask: Essentials만 ($0.005)
- Geoapify/Nominatim/Overpass/OSRM: 전부 무료
