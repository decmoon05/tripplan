# 프론트엔드 개발 가이드

> 이 매뉴얼은 클라이언트 사이드 UI 코드 작성 시 참조한다.
> 관련 매뉴얼: `naming-conventions.md`

## 컴포넌트 구조 원칙

- 컴포넌트는 역할에 따라 분류한다:
  - **Page**: `src/app/` 내 `page.tsx`. 데이터 페칭 담당 (서버 컴포넌트 기본)
  - **Feature**: 특정 기능 단위 컴포넌트 (예: 여행일정편집기, 지도뷰)
  - **UI**: 재사용 가능한 순수 표현 컴포넌트 (버튼, 카드, 모달)

## 파일 배치 규칙

```
src/
├── app/                  # App Router (페이지 + 레이아웃)
│   ├── layout.tsx        # 루트 레이아웃
│   ├── page.tsx          # 홈페이지
│   ├── (auth)/           # 인증 라우트 그룹
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── trips/
│       ├── page.tsx      # 여행 목록
│       └── [tripId]/
│           └── page.tsx  # 여행 상세
├── components/           # UI 컴포넌트
│   ├── ui/               # 재사용 순수 컴포넌트 (Button, Card, Modal)
│   └── features/         # 기능 단위 컴포넌트
│       ├── trip-editor/
│       │   ├── TripEditor.tsx
│       │   ├── TripEditor.test.tsx
│       │   └── useTripEditor.ts
│       └── map/
├── hooks/                # 공통 커스텀 훅
├── stores/               # Zustand 스토어
├── types/                # 타입 정의
└── utils/                # 순수 유틸리티
```

## 서버 컴포넌트 vs 클라이언트 컴포넌트

- **기본은 서버 컴포넌트**: `page.tsx`, `layout.tsx`는 서버 컴포넌트로 작성
- **클라이언트 컴포넌트**: 상호작용(onClick, onChange 등), 브라우저 API, 상태 관리가 필요한 경우에만 `'use client'` 선언
- 클라이언트 컴포넌트는 `components/` 하위에 배치
- 서버 컴포넌트에서 클라이언트 컴포넌트를 import하여 조합

## 상태 관리 원칙

- 서버 상태(API 데이터)와 클라이언트 상태(UI 상태)를 분리한다
- **서버 상태**: TanStack Query 사용 (캐싱, 리페칭 자동화). Supabase 실시간 구독이 필요한 경우 `supabase.channel()` 사용
- **클라이언트 상태**: 가능한 컴포넌트 로컬 state 사용, 필요 시만 Zustand 전역 store
- Server Actions 또는 Route Handler 호출로 데이터 변경

## API 호출 규칙

- 컴포넌트에서 직접 fetch 호출 금지
- **서버 컴포넌트**: Supabase 서버 클라이언트로 직접 데이터 조회 가능
- **클라이언트 컴포넌트**: TanStack Query + Route Handler 호출 패턴 사용
- API 함수는 `src/lib/` 내에 정의하고 타입이 지정된 응답을 반환

```typescript
// src/hooks/useTrips.ts
import { useQuery } from '@tanstack/react-query';

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const res = await fetch('/api/v1/trips');
      if (!res.ok) throw new Error('Failed to fetch trips');
      const json = await res.json();
      return json.data;
    },
  });
}
```

## 컴포넌트 작성 규칙

- Props 타입은 컴포넌트 파일 내 상단에 정의
- 한 컴포넌트 파일은 200줄 이하 유지. 초과 시 분리
- 비즈니스 로직은 커스텀 훅으로 분리
- 인라인 스타일 금지 (Tailwind CSS 사용)

## 폼 처리

- React Hook Form + Zod resolver 사용
- Zod 스키마는 `src/lib/validators/`에 정의하여 서버/클라이언트 공유

## Mock Data 전략 (Phase 1)

Phase 1은 Mock Data 기반 개발이므로:
- Mock 데이터 위치: `src/mocks/`
- 형식: TypeScript 객체 (타입 공유)
- 주요 Mock: Google Places 응답, AI 일정 생성 응답, 사용자 프로필
- Phase 2에서 실제 API로 전환 시 Mock 파일 제거

```typescript
// src/mocks/trips.ts
import type { Trip } from '@/types/trip';

export const mockTrips: Trip[] = [
  {
    id: 'mock-trip-1',
    destination: '도쿄',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    status: 'generated',
    // ...
  },
];
```

## 외부 API 클라이언트 처리

### Google Places API
- 세션 캐시: `sessionStorage`에 30분 TTL로 캐싱
- 캐시 키 형식: `places:{place_id}:{field_mask_hash}`
- 동일 장소 반복 조회 방지: 캐시 확인 → 미스 시만 API 호출
- 세션 토큰: Autocomplete → Place Details 연계 시 세션 토큰 사용

### Google Maps JavaScript API
- 페이지당 1회만 로드 (중복 로드 금지)
- 지도 관련 컴포넌트는 `src/components/features/map/`에 배치
- Google 로고/저작자 표시 누락 **금지** (ToS 위반)

## 금지 사항

- any 타입 사용 금지
- 컴포넌트 내 직접 API 호출 금지
- index.tsx에 로직 작성 금지 (re-export만)
- 미사용 import 방치 금지
- 서버 컴포넌트에 `'use client'` 불필요하게 선언 금지
