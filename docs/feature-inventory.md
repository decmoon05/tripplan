# TripPlan 전체 기능 목록

> 구현 완료 + 기획/논의된 기능 전부 포함
> 2026-04-05 기준

---

## 1. 핵심 플랫폼

| 기능 | 상태 | 설명 |
|------|------|------|
| 이메일 로그인/회원가입 | ✅ | Supabase Auth |
| 온보딩 프로필 (6단계) | ✅ | MBTI → Big Five 성격검사(TIPI 17문항) → 라이프스타일 → 음식 → 관심사(34개 태그) → 확인 |
| 마이페이지 | ✅ | 프로필/이력/통계 3탭, Big Five 점수 카드 |
| 랜딩 페이지 | ✅ | 다크 테마, 애니메이션 웨이브, 터미널 타이핑 효과 |
| 요금제 페이지 | ✅ | Free/Pro/Team 3티어 |
| PWA 오프라인 | ✅ | Service Worker + manifest |
| 관리자 대시보드 | ✅ | 통계, 유저관리, AI 로그, 캐시, 에러, 헬스, 설정, 테스트 |

---

## 2. AI 일정 생성

| 기능 | 상태 | 설명 |
|------|------|------|
| AI 스트리밍 일정 생성 | ✅ | SSE 실시간 스트리밍, 진행 이벤트 표시 |
| 멀티 프로바이더 | ✅ | Gemini → Claude → OpenAI 폴백 체인 |
| v2 파이프라인 (검증+수복) | ✅ | 하루 단위 생성 → validateDay → repairDay → augmentMissingMeals |
| v3 하이브리드 파이프라인 | ✅ | AI는 장소 추천만, 코드가 배치 (ItiNera 논문 기반) |
| v4 3단 군집 트리 | 🔬 실험 | 13개 region, 40개 area, multi-region, 병렬 AI. 오후 공백/attraction 편향 문제로 v5 재설계 |
| Feasibility Check | ✅ | 특별 요청 실현 가능성 사전 확인 |
| 장소 상세 확장 (Expand) | ✅ | 선택한 장소의 메뉴, 옵션, 상세정보 AI 생성 |
| 인기 장소 추천 | ✅ | 목적지별 카테고리 장소 추천 |
| 이전 여행 참조 AI | ✅ | 완료된 여행의 별점 기반 추천 반영 |
| 장소 선호도 시스템 | ✅ | 제외/재방문/신규/숨김 4단계 |
| 계절 이벤트 DB | ✅ | 축제/시즌 이벤트 반영 |
| 비용 안전장치 | ✅ | Gemini 3.1 Pro 자동 차단, 모델별 가격표 관리 |

---

## 3. 성격 기반 개인화

| 기능 | 상태 | 설명 |
|------|------|------|
| MBTI 선택 | ✅ | 16유형, 마케팅/UI용 |
| Big Five 성격검사 (TIPI 17문항) | ✅ | 7점 리커트, 원형 버튼 UI, 실시간 진행률 |
| Big Five → 행동 태그 변환 | ✅ | 외향성→social_energy, 개방성→novelty_seeking 등 5개 도메인 |
| 성격 기반 프롬프트 반영 | ✅ | Gemini/Claude/OpenAI 프롬프트에 personality 태그 포함 |
| 여행 속도 (relaxed/moderate/active) | ✅ | stamina별 일일 장소 수 조절 |
| 예산 범위 | ✅ | budget/moderate/luxury |
| 동행자 유형 | ✅ | solo/couple/friends/family/family-kids/business/other |
| 아침형/저녁형 | ✅ | early/moderate/late → Day 시작 시간 |
| 모험 성향 | ✅ | explorer/balanced/cautious |
| 사진 스타일 | ✅ | sns/casual/minimal |
| 식이제한 | ✅ | vegetarian/vegan/halal/no-seafood 등 8개 |
| 관심사 태그 | ✅ | 34개 (anime, temple, street-food, cafe, romantic, family 등) |
| 자유 텍스트 특별 요청 | ✅ | specialNote (500자) |

---

## 4. Travel Room (그룹 여행)

| 기능 | 상태 | 설명 |
|------|------|------|
| 여행방 만들기 | ✅ | 호스트가 목적지/날짜 설정 |
| 초대 코드로 참여 | ✅ | 링크 공유 → 비로그인도 접근 가능 |
| 실시간 동기화 | ✅ | Supabase Realtime |
| 멤버 투표 | ✅ | 일정 항목별 👍/👎 |
| 실시간 채팅 | ✅ | 방 내 토론 |
| 멤버 성향 종합 AI 생성 | ✅ | 전원 프로필 기반 최적 일정 |

---

## 5. 지도/동선

| 기능 | 상태 | 설명 |
|------|------|------|
| Google Maps 연동 | ✅ | AdvancedMarkerElement로 장소 표시 |
| 경로 최적화 (Greedy NN) | ✅ | 일일 동선 최소화 |
| 이동수단 자동 결정 | ✅ | 거리 기반 (도보/대중교통/택시) |
| 이동시간 표시 (Transit Badge) | ✅ | 장소 간 이동수단 + 소요시간 |
| OSRM 실제 경로 계산 | ✅ | 무료 도로 경로 API |
| Google Directions (Pro) | ✅ | 유료 정밀 이동시간 |
| 지도에 동선 그어주기 | 🟡 논의 | MapView에 polyline 경로 표시 |

---

## 6. 일정 관리 UI

| 기능 | 상태 | 설명 |
|------|------|------|
| 타임라인 뷰 (Day별 카드) | ✅ | DayColumn + TimelineCard |
| 드래그 앤 드롭 재정렬 | ✅ | @dnd-kit로 블록 이동 |
| 일정 아이템 추가/수정/삭제 | ✅ | AddItemModal, EditItemModal |
| "오늘" 하이라이트 | ✅ | 여행 중 해당 Day 자동 스크롤 + 📍 배지 |
| 상대 날짜 표시 | ✅ | D-3, 여행 중, 다녀옴 |
| 여행 완료 상태 | ✅ | draft → generated → confirmed → completed |
| 일괄 평가 모달 | ✅ | 여행 후 별점 + 한줄 메모 |
| 숙소 카드 | ✅ | 전용 AccommodationCard |
| 주의사항 패널 | ✅ | 날씨/안전/환율/공휴일/분위기/재해 |

---

## 7. 실용 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| 실시간 날씨 | ✅ | Open-Meteo (무료, 키 불필요) |
| 실시간 환율 | ✅ | open.er-api (무료) + 6시간 캐시 + fallback |
| 비상 연락처 (22개 도시) | ✅ | 대사관, 경찰, 구급대, 관광경찰 |
| 준비물 체크리스트 | ✅ | AI 생성, 카테고리별 (서류/의류/전자기기/의약품/기타) |
| 예산 관리 | ✅ | 예상 vs 실제, 카테고리별 |
| PDF/인쇄 내보내기 | ✅ | CSS @media print |
| ICS 캘린더 내보내기 | ✅ | Google Calendar/Apple Calendar |
| 사진 갤러리 | ✅ | Supabase Storage |
| 별점 평가 | ✅ | 장소별 1~5점 |
| 리마인더 설정 | ✅ | 출발 N일 전 알림 (Edge Function 별도 필요) |
| 공유 링크 | ✅ | 토큰 기반 읽기 전용 공유 |

---

## 8. 데이터 인프라 (v4에서 구축)

| 기능 | 상태 | 설명 |
|------|------|------|
| 1차 군집 (Region) DB | ✅ | 13개 일본 지역, monthly_score, peak_events, 전체 필드 |
| 2차 군집 (Area) DB | ✅ | 40개 동네, time_profile, interest_tags, parking 등 |
| 광역 그룹 매핑 | ✅ | 규슈→5개, 간사이→2개, 추부→2개 등 7그룹 |
| Region 간 이동 시간 | ✅ | 7쌍 (JR/신칸센, haversine fallback) |
| Nominatim 좌표 검색 | ✅ | Geoapify 우선 + Nominatim fallback, 좌표 기반 viewbox |
| Overpass 영업시간 조회 | ✅ | OpenStreetMap POI |
| Google Places 검증 | ✅ | FieldMask Essentials ($0.005/건) |
| 장소 캐시 (place_cache) | ✅ | 식당 3일, 장소 30일 유효 |

---

## 9. v4에서 논의/기획된 기능 (미구현 또는 실험적)

| 기능 | 상태 | 설명 |
|------|------|------|
| Multi-Region 파이프라인 | 🔬 실험 | "후쿠오카 3일 + 나가사키 2일" multi-city |
| Region 전환일 보정 | 🔬 실험 | adjustForRegionTransit — 이동시간만큼 가용시간 축소 |
| regionAllocator (1순위) | 🔬 실험 | 사용자 직접 region 지정 |
| regionAllocator (2순위) | 📋 계획 | 숙소 좌표 기반 자동 매칭 (Phase 4) |
| regionAllocator (3순위) | 📋 계획 | 프로필 기반 자동 배분 (Phase 4) |
| 여행 요청사항 → AI → forcedPlaces | 📋 계획 | "에반게리온 성지순례" → AI가 장소 찾기 → 강제 배정 |
| 1차 군집 간 이동을 TripItem에 표시 | 📋 계획 | "JR 소닉 하카타→벳푸 2.5시간" 항목 |
| 이동 수단 선택 UI | 📋 계획 | 신칸센/JR/버스/렌터카 선택 |
| 이동 비용 예산 반영 | 📋 계획 | 교통비 포함 |
| 프로 3개 결과 비교 | 📋 계획 | 같은 풀에서 조합 변경, Places 검증 차이분만 추가 비용 |
| 지역 친숙도 질문 UI | 📋 계획 | "이 지역을 얼마나 아시나요?" → 자동/선택 분기 |
| 할루시네이션 감지 필터 | 🔬 실험 | 도로명/역명/편의점 패턴 감지 |
| costFitScore (예산 적합도) | 🔬 실험 | budgetRange vs estimatedCost 비교 |
| nightComfort (야간 활동 선호) | 🔬 실험 | 야간 시간대 스코어링 반영 |
| gender (성별) | ✅ DB만 | 온천/사우나 필터, 야간 안전용. 로직 미사용 |
| max_walking_minutes (도보 한계) | ✅ DB만 | 동선 최적화에서 대중교통 전환 트리거 |
| wished_activities (희망 액티비티) | ✅ DB만 | Phase 4 B분기에서 AI 호출 → forcedPlaces |

---

## 10. 미구현 로드맵

| 기능 | 우선순위 | 설명 |
|------|---------|------|
| 다국어 (i18n) | 높음 | next-intl, EN/JA/KO |
| 이메일 리마인더 발송 | 높음 | Supabase Edge Functions + Resend |
| 커뮤니티/탐색 (/explore) | 중간 | 공개 여행, 리뷰, 태그 검색 |
| 숙소 추천/연동 | 중간 | 지역별 숙소 제안 + 예약 링크 |
| 항공권 추천/연동 | 중간 | 항공사 API or 어필리에이트 |
| 네이버/카카오 국내 데이터 | 중간 | 한국 지역 POI 소스 |
| 모바일 네이티브 앱 | 낮음 | React Native (현재 PWA) |
| 접근성 (휠체어) 필터 | 낮음 | 페르소나 P12에서 발견, 데이터 소스 문제 |
| 반려동물 동반 필터 | 낮음 | 페르소나 P13에서 발견 |
| 종교적 시간 제약 | 낮음 | 라마단/기도시간 (페르소나 P11) |
| 크루즈 기항지 관광 | 낮음 | 극단적 시간 제약 + 왕복 동선 (페르소나 P16) |

---

## 11. 기술 인프라

| 항목 | 상태 | 설명 |
|------|------|------|
| Supabase Auth + RLS | ✅ | 전 테이블 Row Level Security |
| 에러 핸들링 중앙화 | ✅ | AppError + handleApiError |
| Rate Limiting | ✅ | 엔드포인트별 일일 한도, 플랜별 배수 |
| 요금제별 기능 차등 | ✅ | getPlanFeatures() — AI 모델/Places/Directions 등 |
| XSS 방지 | ✅ | Zod validator에서 <> 스트립 |
| SQL Injection 방지 | ✅ | Supabase 쿼리빌더 (raw query 없음) |
| Error Boundary | ✅ | React ErrorBoundary in layout |
| tsc 자동 타입체크 | ✅ | PostToolUse hook |
| .env 수정 자동 차단 | ✅ | PreToolUse hook |
