/**
 * 테스트 전용 AI 생성 엔드포인트
 * - DB 저장 안 함
 * - rate limit 기록 안 함
 * - Layer 1 검증 결과를 JSON으로 반환
 * - 인증: admin 세션 또는 x-admin-key 헤더
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { handleApiError } from '@/lib/errors/handler';
import { AppError } from '@/lib/errors/appError';
import { generateItineraryStream, generateItinerary } from '@/lib/services/ai.service';
import { generateItineraryV3 } from '@/lib/services/ai/v3/pipelineV3';
import type { V3Config } from '@/lib/services/ai/v3/types';
import { getRuntimeConfig } from '@/lib/services/runtimeConfig';
import { getPlanFeatures } from '@/lib/services/rateLimit.service';
import { postValidateItems } from '@/lib/services/ai/postValidate';
import { validateGeoBoundary, optimizeRouteOrder, validateTransitFeasibility, validateClosedDays, augmentMissingMeals } from '@/lib/services/ai/itineraryValidation';
import { runAllValidations, type TestItem, type ValidationConfig } from '@/lib/services/ai/testValidation';
import { getVerifiedPlacesForDestination } from '@/lib/services/ai/popularPlaces';
import type { CachedPlace } from '@/lib/services/googlePlaces.service';
import type { VerifiedPlace } from '@/lib/services/ai/types';
import type { TripItem } from '@/types/database';
import { getDayCount } from '@/utils/date';

/** 목적지 → 현지 통화 매핑 */
function detectCurrency(destination: string): string {
  const d = destination.toLowerCase();
  const map: Record<string, string> = {
    '일본': 'JPY', '도쿄': 'JPY', '오사카': 'JPY', '교토': 'JPY', '후쿠오카': 'JPY', '나라': 'JPY', '오키나와': 'JPY', '홋카이도': 'JPY', '규슈': 'JPY', '사가': 'JPY',
    '한국': 'KRW', '서울': 'KRW', '부산': 'KRW', '제주': 'KRW',
    '미국': 'USD', '뉴욕': 'USD', '하와이': 'USD',
    '영국': 'GBP', '런던': 'GBP',
    '프랑스': 'EUR', '파리': 'EUR', '독일': 'EUR', '이탈리아': 'EUR', '로마': 'EUR', '스위스': 'CHF', '바르셀로나': 'EUR', '프라하': 'CZK',
    '태국': 'THB', '방콕': 'THB',
    '베트남': 'VND', '하노이': 'VND', '호치민': 'VND',
    '대만': 'TWD', '타이베이': 'TWD',
    '중국': 'CNY', '상하이': 'CNY',
    '싱가포르': 'SGD',
    '인도네시아': 'IDR', '발리': 'IDR',
    '아이슬란드': 'ISK',
    '몰디브': 'MVR',
    '네팔': 'NPR',
    '두바이': 'AED',
  };
  for (const [key, val] of Object.entries(map)) {
    if (d.includes(key)) return val;
  }
  return 'USD'; // 기본값
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TestScenarioInput {
  id: string;
  profile: Record<string, any>;
  tripInput: { destination: string; startDate: string; endDate: string };
  placePreferences?: { placeName: string; preference: string }[];
  validationConfig: ValidationConfig;
}

async function verifyAdminAccess(request: NextRequest): Promise<void> {
  // 방법 1: x-admin-key 헤더 (Python CLI용)
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey && adminKey === process.env.ADMIN_TEST_KEY) return;

  // 방법 2: 세션 기반 admin 확인
  const { supabase, user } = await getAuthUser();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'developer')) {
    throw new AppError('FORBIDDEN', '관리자 또는 개발자 권한 필요', 403);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    await verifyAdminAccess(request);

    const body: TestScenarioInput = await request.json();
    const { profile, tripInput, placePreferences, validationConfig } = body;

    // Google Places 캐시 — v3에서는 placeEnricher가 처리하므로 스킵
    let verifiedPlaces: VerifiedPlace[] = [];
    const cachedPlaceIds = new Set<string>();
    const useV3 = process.env.PIPELINE_VERSION === 'v3';
    if (!useV3) try {
      const { supabase } = await getAuthUser();
      const cached = await getVerifiedPlacesForDestination(supabase, tripInput.destination);
      verifiedPlaces = cached.map((c: CachedPlace) => ({
        googlePlaceId: c.googlePlaceId,
        displayName: c.displayName,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        rating: c.rating,
        businessHours: c.businessHours,
        closedDays: c.closedDays,
        category: c.category,
      }));
      for (const vp of verifiedPlaces) cachedPlaceIds.add(vp.googlePlaceId);
    } catch {
      // Places 캐시 없이 진행
    }

    // AI 생성
    // 5일+ 여행: 비스트리밍(Day별 청킹) 사용 → 각 Day를 개별 호출하여 토큰 한도 회피
    // 4일 이하: 스트리밍 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dayCount = Math.ceil(
      (new Date(tripInput.endDate).getTime() - new Date(tripInput.startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    let items: TripItem[] = [];
    let tripSummary = '';
    let v3Cost: any = null;
    let advisories: unknown = {};
    const providerName = process.env.AI_PROVIDER || 'mock';
    const modelName = providerName === 'gemini'
      ? (process.env.GEMINI_PRO_MODEL || 'gemini-2.5-flash')
      : providerName;
    let groundingSources: { title: string; url: string }[] = [];

    const runtimeConfig = getRuntimeConfig();
    const totalDays = getDayCount(tripInput.startDate, tripInput.endDate);

    if (runtimeConfig.pipelineVersion === 'v3') {
      // ─── v3 파이프라인: AI는 장소만, 코드가 배치 ───
      console.log(`[TestGenerate] v3 파이프라인 — ${dayCount}일 여행`);
      const planFeatures = getPlanFeatures('pro'); // 테스트는 항상 Pro 기능 사용
      const v3Config: V3Config = {
        destination: tripInput.destination,
        startDate: tripInput.startDate,
        endDate: tripInput.endDate,
        totalDays,
        itemsPerDay: { low: 4, moderate: 5, high: 7 }[profile.lifestyle?.stamina as string || 'moderate'] || 5,
        stamina: (profile.lifestyle?.stamina as 'low' | 'moderate' | 'high') || 'moderate',
        arrivalTime: (profile.arrivalTime as 'morning' | 'afternoon' | 'evening') || 'morning',
        morningType: (profile.lifestyle?.morningType as 'early' | 'moderate' | 'late') || 'moderate',
        isRentalCar: !!(profile.specialNote && /렌터카|렌트카|rental|rent.*car/i.test(profile.specialNote)),
        currency: detectCurrency(tripInput.destination),
        usePlaces: planFeatures.places,
        useDirections: false, // 테스트에서는 Directions 스킵
        maxRepairs: planFeatures.repairs,
      };

      const v3Result = await generateItineraryV3(
        profile as any,
        { destination: tripInput.destination, startDate: tripInput.startDate, endDate: tripInput.endDate },
        v3Config,
        placePreferences?.map(p => ({ placeName: p.placeName, preference: p.preference as 'exclude' | 'revisit' | 'new' | 'hidden' })),
        verifiedPlaces.length > 0 ? verifiedPlaces : undefined,
      );
      items = v3Result.items;
      tripSummary = v3Result.tripSummary || '';
      advisories = v3Result.advisories || {};
      // v3 비용 추적
      v3Cost = v3Result.cost;
    } else {
      // ─── v2 파이프라인: 기존 방식 ───
      console.log(`[TestGenerate] v2 파이프라인 — ${dayCount}일 여행`);
      const result = await generateItinerary(
        profile as any,
        { destination: tripInput.destination, startDate: tripInput.startDate, endDate: tripInput.endDate },
        placePreferences?.map(p => ({ placeName: p.placeName, preference: p.preference as 'exclude' | 'revisit' | 'new' | 'hidden' })),
        verifiedPlaces.length > 0 ? verifiedPlaces : undefined,
      );
      items = result.items as TripItem[];
      tripSummary = result.tripSummary || '';
      advisories = result.advisories || {};
      groundingSources = (result as any).groundingSources || [];

      // v2 Post-validation 파이프라인
      try {
        items = await postValidateItems(items, tripInput.destination, cachedPlaceIds);
      } catch {
        // 사후 검증 실패 시 raw 아이템으로 계속
      }
      items = validateClosedDays(items, tripInput.startDate);
      items = validateGeoBoundary(items);
      items = optimizeRouteOrder(items);
      items = validateTransitFeasibility(items);
      items = augmentMissingMeals(items, profile.arrivalTime as string | undefined, totalDays);
    }

    // Layer 1 규칙 검증
    const testItems: TestItem[] = items.map(it => ({
      dayNumber: it.dayNumber,
      orderIndex: it.orderIndex,
      placeNameSnapshot: it.placeNameSnapshot,
      category: it.category,
      startTime: it.startTime,
      endTime: it.endTime,
      estimatedCost: it.estimatedCost,
      currency: it.currency,
      notes: it.notes,
      latitude: it.latitude,
      longitude: it.longitude,
      transitMode: it.transitMode,
      transitDurationMin: it.transitDurationMin,
      transitSummary: it.transitSummary,
      closedDays: it.closedDays,
      reasonTags: it.reasonTags || [],
      activityLevel: 'moderate', // TripItem에 없으므로 기본값
    }));

    const validation = runAllValidations(
      testItems,
      {
        specialNote: profile.specialNote,
        budgetRange: profile.budgetRange,
        companion: profile.companion,
        arrivalTime: profile.arrivalTime,
        foodPreference: profile.foodPreference,
        travelPace: profile.travelPace,
        lifestyle: { stamina: profile.lifestyle?.stamina || profile.stamina || 'moderate' },
      },
      validationConfig,
      tripInput.startDate,
    );

    const durationMs = Date.now() - startTime;
    const passCount = validation.filter(v => v.pass).length;

    return NextResponse.json({
      success: true,
      data: {
        scenarioId: body.id,
        items: testItems,
        tripSummary,
        advisories,
        groundingSources,
        validation,
        summary: {
          totalChecks: validation.length,
          passed: passCount,
          failed: validation.length - passCount,
          passRate: `${((passCount / validation.length) * 100).toFixed(1)}%`,
        },
        meta: {
          provider: providerName,
          model: modelName,
          durationMs,
          itemCount: items.length,
          estimatedCostUSD: typeof v3Cost !== 'undefined' ? v3Cost?.totalCostUSD ?? 0 : 0,
        },
        cost: typeof v3Cost !== 'undefined' ? v3Cost : null,
      },
      error: null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error('[TestGenerate] Error:', msg);
    if (stack) console.error(stack);
    // 개발 환경에서는 상세 에러 반환
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'TEST_ERROR', message: msg, stack: stack?.split('\n').slice(0, 5) },
      }, { status: 500 });
    }
    return handleApiError(error);
  }
}
