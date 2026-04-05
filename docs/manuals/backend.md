# 백엔드 개발 가이드

> 이 매뉴얼은 서버 사이드 코드 작성 시 참조한다.
> 관련 매뉴얼: `api-design.md`, `error-handling.md`, `security.md`

## 서버 구조 원칙

- 계층 분리를 준수한다: `Route Handler → Service → Supabase Client`
- 각 계층은 자기 역할만 수행한다:
  - **Route Handler** (`src/app/api/`): 요청 파싱, 입력 검증, 응답 포맷팅. 비즈니스 로직 금지
  - **Service** (`src/lib/services/`): 비즈니스 로직 전담. 요청/응답 객체(NextRequest/NextResponse) 접근 금지
  - **Supabase Client** (`src/lib/supabase/`): 데이터 접근. Supabase가 타입 안전한 쿼리 빌더를 제공하므로 별도 Repository 계층 불필요

## 파일 배치 규칙

```
src/
├── app/api/              # Route Handlers (라우팅 + 요청/응답 처리)
│   └── v1/
│       ├── trips/route.ts
│       ├── trips/[tripId]/route.ts
│       └── ai/generate/route.ts
├── lib/                  # 비즈니스 로직 + 인프라
│   ├── services/         # 비즈니스 로직
│   │   ├── trip.service.ts
│   │   ├── places/       # Google Places API 래핑
│   │   └── payment/      # PG사 결제 (Phase 3)
│   ├── supabase/         # Supabase 클라이언트 설정
│   │   ├── client.ts     # 브라우저용 (createBrowserClient)
│   │   ├── server.ts     # 서버 컴포넌트/Route Handler용 (createServerClient)
│   │   └── admin.ts      # 서비스 롤 키 사용 (관리자 작업)
│   ├── validators/       # Zod 스키마
│   └── errors/           # 커스텀 에러 클래스
├── middleware.ts          # Next.js 미들웨어 (인증 세션 갱신)
```

## Route Handler 작성 패턴

```typescript
// src/app/api/v1/trips/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTripSchema } from '@/lib/validators/trip';
import { TripService } from '@/lib/services/trip.service';
import { handleApiError } from '@/lib/errors/handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
        { status: 401 }
      );
    }

    const trips = await TripService.getUserTrips(supabase, user.id);
    return NextResponse.json({ success: true, data: trips, error: null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = createTripSchema.parse(body);
    const trip = await TripService.createTrip(supabase, user.id, validated);
    return NextResponse.json({ success: true, data: trip, error: null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

## 미들웨어 규칙

- `src/middleware.ts`에서 Supabase 인증 세션 갱신을 처리
- 인증이 필요한 경로를 matcher로 지정
- 입력 검증은 Route Handler 내에서 Zod 스키마로 처리

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: ['/api/v1/:path*', '/trips/:path*', '/profile/:path*'],
};
```

## 의존성 패턴

- 모듈 임포트 패턴을 사용한다 (생성자 의존성 주입 불필요)
- Service 함수는 Supabase 클라이언트를 파라미터로 받는다 (테스트 시 모킹 용이)
- 외부 API 서비스도 동일 패턴 적용

```typescript
// src/lib/services/trip.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const TripService = {
  async getUserTrips(supabase: SupabaseClient<Database>, userId: string) {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};
```

## 응답 형식 통일

```json
{
  "success": true,
  "data": { },
  "error": null
}
```

실패 시:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "여행 계획을 찾을 수 없습니다" }
}
```

## 외부 API 연동

### Google Places API 사용 규칙

> **ToS 준수 필수. 위반 시 API 키 정지 및 법적 조치 가능.**

#### 캐싱 정책
- `place_id`만 DB에 저장 허용. 그 외 데이터(이름, 평점, 영업시간, 사진 URL 등)의 영구 저장 **금지**
- 상세 정보는 매번 Places API를 호출하여 조회
- 클라이언트 측 세션 캐시(30분)는 허용 → `sessionStorage` 활용
- AI 일정 생성 시 `place_name_snapshot`은 표시용 스냅샷으로 저장 가능 (갱신 의무 없음)

#### 비용 최적화
- **필드 마스크 필수:** 필요한 필드만 요청 (전체 필드 요청 시 비용 증가)
- 세션 토큰 사용: Autocomplete → Place Details 연계 시 세션 토큰으로 비용 절감
- 동일 장소 반복 조회 방지: 클라이언트 캐시 확인 후 API 호출

```typescript
// 올바른 예: 필드 마스크 적용
const response = await fetch(
  `https://places.googleapis.com/v1/places/${placeId}`,
  {
    headers: {
      'X-Goog-FieldMask': 'displayName,rating,currentOpeningHours,photos'
    }
  }
);

// 금지: 필드 마스크 없이 전체 조회
// const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`);
```

### PG사 결제 연동 (Phase 3)

> **여신전문금융업법은 PG사 운영에 적용. PG 서비스 이용은 사업자등록증만 있으면 가능.**

#### 연동 가이드
- 후보 PG사: 토스페이먼츠 (개발자 친화적), NicePay, KG이니시스
- 결제 데이터는 PG사가 관리, 우리 DB에는 `pg_transaction_id`와 상태만 저장
- 카드 정보를 직접 수집/저장하지 않음 (PCI DSS 범위 밖으로 유지)

### 식사 비용 추정 방식

> **Google Places API `price_level`은 상대적 등급(INEXPENSIVE~VERY_EXPENSIVE)이며 실제 금액이 아님.**

#### 올바른 접근
- `price_level`은 참고 지표로만 사용 (직접 금액 변환 금지)
- AI가 리뷰 텍스트에서 가격 정보를 추출하여 추정
- 추정값은 반드시 "참고용"으로 표시, 정확도 보장 불가 명시
- 지역/국가별 물가 차이를 AI 프롬프트에 컨텍스트로 제공

## 금지 사항

- Route Handler에서 직접 Supabase 쿼리를 인라인으로 나열 금지 (Service로 분리)
- Service에서 NextRequest/NextResponse 접근 금지
- 하드코딩된 설정값 금지 (환경 변수 사용)
- console.log 대신 로거 사용
- **Google Places API 데이터(place_id 제외) DB 영구 저장 금지**
- **price_level 값을 직접 원화/달러 금액으로 변환 금지**
- **Supabase 서비스 롤 키를 클라이언트 사이드에서 사용 금지**
