# 맥락 노트: 이동정보 + 영업정보 + 팩트체크

## 핵심 설계 결정
- 이동정보는 별도 아이템이 아닌 각 아이템의 필드로 추가 (DnD 꼬임 방지)
- 주소는 현지어 (Google Maps 검색 가능)
- 각 날 첫 아이템의 transit 필드는 null

## 새 필드 6개
| 필드 | DB 컬럼 | 타입 |
|------|---------|------|
| address | address | text, null |
| businessHours | business_hours | text, null |
| closedDays | closed_days | text, null |
| transitMode | transit_mode | text, null |
| transitDurationMin | transit_duration_min | integer, null |
| transitSummary | transit_summary | text, null |

## 진행 기록
- 2026-03-18: 작업 시작
