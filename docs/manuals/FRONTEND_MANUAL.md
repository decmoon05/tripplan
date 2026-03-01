# 프론트엔드 매뉴얼

> 화면/컴포넌트/React Native 작업 시 이 매뉴얼을 읽을 것.

---

## 1. 기본 원칙

- **프레임워크**: React Native (Expo SDK)
- **언어**: TypeScript strict mode
- **스타일**: NativeWind (Tailwind CSS for RN) 또는 StyleSheet
- **상태관리**: Zustand (전역) + React Query (서버 상태)
- **네비게이션**: Expo Router (파일 기반)

---

## 2. 폴더 구조

```
apps/mobile/
├── app/                 # Expo Router 페이지
│   ├── (auth)/          # 로그인/회원가입
│   ├── (tabs)/          # 메인 탭 화면
│   └── trip/[id]/       # 여행 상세
├── components/
│   ├── ui/              # 기본 UI 컴포넌트 (Button, Card, etc.)
│   ├── travel/          # 여행 관련 컴포넌트
│   └── profile/         # 프로파일링 관련 컴포넌트
├── hooks/               # 커스텀 훅
├── stores/              # Zustand 스토어
├── services/            # API 호출 함수
└── types/               # TypeScript 타입
```

---

## 3. 컴포넌트 규칙

### 기본 패턴
```tsx
// components/travel/PlaceCard.tsx
interface PlaceCardProps {
  place: Place;
  onPress: (id: string) => void;
  compact?: boolean;  // 기본 간결 뷰, true 시 상세 뷰
}

export function PlaceCard({ place, onPress, compact = true }: PlaceCardProps) {
  // ...
}
```

- 컴포넌트 파일명은 PascalCase.
- Props 타입은 항상 interface로 정의.
- 기본값이 있는 props는 명시적으로 선언.
- 컴포넌트는 100줄 이하 유지. 넘으면 분리.

---

## 4. UI/UX 핵심 원칙

TripWise의 핵심 UX 철학:
- **정보량 제어**: 기본은 간결히, 사용자가 원하면 펼쳐서 더 보기.
- **탭/버튼 우선**: 채팅 입력보다 탭 선택 우선 (빠른 조작).
- **즉흥 변경 지원**: 화면 전환 없이 인라인 수정 가능해야 함.
- **모바일 최적화**: 터치 영역 최소 44x44pt. 스크롤은 자연스럽게.

### 여행지 카드 정보 표시 원칙
```
기본 표시: 이름, 카테고리 아이콘, 평점, 거리
펼치기 시: 설명, 영업시간, 가격대, 층수, 주차 여부
```

---

## 5. 상태관리 규칙

```typescript
// stores/tripStore.ts - Zustand 예시
interface TripStore {
  currentTrip: Trip | null;
  userProfile: UserProfile | null;
  setCurrentTrip: (trip: Trip) => void;
  updateItinerary: (day: number, places: Place[]) => void;
}
```

- 서버 데이터(API 응답)는 React Query로 관리.
- 클라이언트 전용 상태(UI 상태, 필터)는 Zustand로 관리.
- 컴포넌트 내 로컬 상태는 useState.

---

## 6. 성능 규칙

- 리스트는 `FlatList` 사용 (ScrollView + map 금지, 성능 이슈).
- 이미지는 `expo-image` 사용 (캐싱 지원).
- 무거운 컴포넌트는 `React.memo` 또는 `useMemo` 고려.
- API 호출은 React Query의 캐싱 활용.

---

## 7. 접근성 (Accessibility)

- 모든 버튼에 `accessibilityLabel` 추가.
- 색상만으로 정보 전달 금지 (색맹 고려).
- 텍스트 최소 크기 14sp.
