# UI 수정 맥락 노트

## 문제
1. 지도 미표시: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 비어있었음 → 설정 완료
2. AI가 JPY 기준 가격 생성 → "원"으로 표시됨 (오사카 930원 = 실제 930엔)
3. AI 추정 가격의 신뢰도 표시 없음

## 수정 방향
- AI 프롬프트: currency 필드 추가 + priceConfidence (confirmed/estimated) 필드 추가
- DB/타입: currency, priceConfidence 필드 추가 (trip_items)
- UI: 통화 기호 표시 + "추측" 라벨 조건부 표시
- TimelineCard: 가격 표시 포맷 변경 (¥930 또는 ~¥930 추측)
