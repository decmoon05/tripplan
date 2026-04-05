/**
 * v3 하이브리드 아키텍처 타입 정의
 *
 * AI는 장소 추천만 (8필드), 나머지는 코드가 계산.
 */

/** AI가 출력하는 장소 추천 (8필드만) */
export interface AIPlaceRecommendation {
  placeNameSnapshot: string;        // "후쿠오카 타워 (福岡タワー)"
  category: 'attraction' | 'restaurant' | 'cafe' | 'shopping';
  notes: string;                     // 한줄 한국어 설명
  reasonTags: string[];              // 2~4개 한국어 태그
  mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'none';
  estimatedDurationMinutes: number;  // 30~180
  estimatedCost: number;             // 현지 통화 정수
  timePreference: 'morning' | 'afternoon' | 'evening' | 'anytime';
  placeConfidence?: 'verified' | 'unverified';
}

/** API 호출 비용 추적 */
export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
  costUSD: number;
}

/** 전체 파이프라인 비용 추적 */
export interface V3CostTracker {
  gemini: { calls: number; inputTokens: number; outputTokens: number; model: string; costUSD: number };
  nominatim: { calls: number; costUSD: number };
  overpass: { calls: number; costUSD: number };
  osrm: { calls: number; costUSD: number };
  googlePlaces: { calls: number; costUSD: number };
  googleDirections: { calls: number; costUSD: number };
  totalCostUSD: number;
}

/** AI 전체 응답 (추천 + 메타데이터 + 비용) */
export interface AIV3Response {
  places: AIPlaceRecommendation[];
  tripSummary?: string;
  advisories?: {
    weather?: string;
    safety?: string;
    health?: string;
    transport?: string;
    culture?: string;
    budget?: string;
  };
  _usage?: UsageInfo;
}

/** 보강 후 장소 데이터 */
export interface EnrichedPlace extends AIPlaceRecommendation {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  businessHours: string | null;
  closedDays: string | null;
  rating: number | null;
  googlePlaceId: string | null;
  photoUrl: string | null;       // Wikipedia 또는 Google Photos URL
  verified: boolean;
}

/** 슬롯 배정 후 일정 아이템 */
export interface AssignedItem extends EnrichedPlace {
  dayNumber: number;
  orderIndex: number;
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
  transitMode: string | null;
  transitDurationMin: number | null;
  transitSummary: string | null;
  activityLevel: 'light' | 'moderate' | 'intense';
  currency: string;
  priceConfidence: 'confirmed' | 'estimated';
}

/** v3 파이프라인 설정 */
export interface V3Config {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  itemsPerDay: number;        // stamina 기반 (low: 3~4, moderate: 4~6, high: 5~8)
  stamina: 'low' | 'moderate' | 'high';
  arrivalTime: 'morning' | 'afternoon' | 'evening';
  morningType: 'early' | 'moderate' | 'late';
  isRentalCar: boolean;
  currency: string;           // 현지 통화 코드 (JPY, USD, EUR...)
  usePlaces: boolean;         // Pro: true, Free: false
  useDirections: boolean;     // Pro: true, Free: false
  maxRepairs: number;         // Free: 0, Pro: 1, Team: 2
}

/** v3 스트리밍 이벤트 */
export type V3StreamEvent =
  | { type: 'progress'; message: string }
  | { type: 'places_received'; count: number }
  | { type: 'enrichment_progress'; current: number; total: number; placeName: string }
  | { type: 'meal_supplement'; count: number }
  | { type: 'slot_assigned'; day: number; itemCount: number }
  | { type: 'audit_complete'; issueCount: number }
  | { type: 'complete'; items: AssignedItem[]; tripSummary?: string; advisories?: AIV3Response['advisories'] }
  | { type: 'error'; message: string };

/** Audit 2nd call — 의미 검증 결과 */
export interface AuditIssue {
  check: number;       // 1~6 (CHECK 번호)
  item: string;        // 문제 아이템 이름
  issue: string;       // 문제 설명
  fix: string;         // 수정 내용
}

export interface AuditResult {
  issues: AuditIssue[];
  items: import('@/types/database').TripItem[];
}
