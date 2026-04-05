# v3 정리 체크리스트

- [ ] v2 후처리 제거 (validateClosedDays, validateGeoBoundary를 pipelineV3에서 제거)
- [ ] 실패 시 AI 재요청 루프 (Phase 6.5) 추가
- [ ] timeCalculator 18:00 강제 제거 → AI의 timePreference 존중
- [ ] 사용자 의도(specialNote) → 검증 기준 동적 변경
- [ ] 제주 데이터 커버리지 개선 (한국 지역 Nominatim 대안 검토)
- [ ] 테스트: edge 10개 재실행
- [ ] 문서화: cycle-21 리포트
