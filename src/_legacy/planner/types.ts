/**
 * v4 3단 군집 트리 타입 정의
 *
 * 1차 군집(Region): 국가 내 대지역 (규슈, 간사이, 간토 등)
 * 2차 군집(Area): 동네 레벨 (도톤보리, 난바, 심사이바시 등)
 * 3차: AI 추천 장소 (Phase 2에서 구현)
 */

// ─── 1차 군집 (지역 레벨) ───────────────────────────────────────────────────

export interface PeakEvent {
  month: number;       // 1~12
  name: string;        // "벚꽃 시즌", "삿포로 눈 축제"
  boost: number;       // 추가 점수 (0~1)
}

export interface TravelDurationRange {
  minDays: number;
  idealDays: number;
  maxDays: number;
}

export interface Region {
  id: string;
  country: string;
  regionName: string;           // "Kyushu"
  regionNameKo: string;         // "규슈"
  regionNameLocal: string;      // "九州"
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  currencyCode: string;         // ISO 4217 (JPY, USD)
  languagePrimary: string;      // "ja", "en"
  englishProficiency: number;   // 0~1
  airportCodes: string[];       // ["FUK", "KOJ"]
  travelDurationRange: TravelDurationRange;
  urbanization: number;         // -1(한적) ~ +1(번화)
  monthlyScore: number[];       // 12개월 추천 점수 (인덱스 0=1월)
  peakEvents: PeakEvent[];
  safetyLevel: number;          // 1~5
  budgetLevel: number;          // 1~5
  familyFriendly: number;       // 0~1
  publicTransportCoverage: number; // 0~1
  visaPolicyRef: string | null; // visa_policies 테이블 룩업 키
  createdAt: string;
  updatedAt: string;
}

// ─── 2차 군집 (동네 레벨) ───────────────────────────────────────────────────

export interface TimeProfile {
  earlyMorning: number;   // 06-09, 0~1 활성도
  morning: number;        // 09-12
  afternoon: number;      // 12-15
  lateAfternoon: number;  // 15-18
  evening: number;        // 18-21
  night: number;          // 21-00
}

export interface ParkingInfo {
  available: boolean;
  difficulty: number;       // 0~1 (0=쉬움, 1=극어려움)
  avgCostPerHour: number;   // 현지 통화
}

export interface Area {
  id: string;
  parentRegionId: string;         // FK → Region
  areaName: string;               // "Dotonbori"
  areaNameKo: string;             // "도톤보리"
  areaNameLocal: string;          // "道頓堀"
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  budgetLevel: number;            // 1~5 (동네 수준 물가)
  safetyLevel: number;            // 1~5 (동네 수준 치안)
  poiDensity: number;             // 단위면적당 POI 수
  crowdLevel: number;             // 0~1 (관광객 밀집도)
  indoorRatio: number;            // 0~1 (실내 비율, 비 올 때 활용)
  timeProfile: TimeProfile;
  interestTags: string[];         // ["쇼핑", "먹거리", "역사"]
  transportAccessibility: number; // 0~1 (대중교통 접근성)
  parking: ParkingInfo;
  terrainDifficulty: number;      // 0~1 (고저차/경사)
  typicalClosedDays: Record<string, number>; // { "monday": 0.4 } = 월 40% 휴무
  averageStayHours: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Day 컨텍스트 ───────────────────────────────────────────────────────────

export interface Accommodation {
  lat: number;
  lon: number;
  name: string;
}

export interface ForcedPlace {
  placeName: string;
  startTime: string;              // "14:00"
  estimatedDurationMin: number;
  clusterId?: string;
}

export interface DayContext {
  dayNumber: number;
  date: string;                   // "2026-04-27"
  dayOfWeek: string;              // "월"
  accommodation: Accommodation | null;
  transportMode: 'public' | 'car' | 'taxi' | 'mixed';
  availableHours: {
    start: number;                // 6~23
    end: number;
  };
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  forcedRegionId: string | null;
  forcedPlaces: ForcedPlace[];
  isTransitDay?: boolean;          // region 전환일 여부
  transitFromRegion?: string;      // 출발 region 이름 (debug/UI용)
  transitDurationMin?: number;     // 이동 소요 시간 (분)
}

// ─── DB row 타입 (snake_case, Supabase 직접 매핑) ───────────────────────────

export interface RegionRow {
  id: string;
  country: string;
  region_name: string;
  region_name_ko: string;
  region_name_local: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  currency_code: string;
  language_primary: string;
  english_proficiency: number;
  airport_codes: string[];
  travel_duration_range: TravelDurationRange;
  urbanization: number;
  monthly_score: number[];
  peak_events: PeakEvent[];
  safety_level: number;
  budget_level: number;
  family_friendly: number;
  public_transport_coverage: number;
  visa_policy_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface AreaRow {
  id: string;
  parent_region_id: string;
  area_name: string;
  area_name_ko: string;
  area_name_local: string;
  center_lat: number;
  center_lon: number;
  radius_km: number;
  budget_level: number;
  safety_level: number;
  poi_density: number;
  crowd_level: number;
  indoor_ratio: number;
  time_profile: TimeProfile;
  interest_tags: string[];
  transport_accessibility: number;
  parking: ParkingInfo;
  terrain_difficulty: number;
  typical_closed_days: Record<string, number>;
  average_stay_hours: number;
  created_at: string;
  updated_at: string;
}

// ─── 3차 장소 후보 ──────────────────────────────────────────────────────────

export type PlaceCategory = 'attraction' | 'restaurant' | 'cafe' | 'shopping';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'none';
export type PlaceConfidence = 'unverified' | 'geocoded' | 'hours_confirmed' | 'verified';

/** AI 추천 → 필터 → 스코어 → 검증을 거치는 장소 후보 */
export interface PlaceCandidate {
  placeNameSnapshot: string;          // "한국어 (현지어)"
  category: PlaceCategory;
  reasonTags: string[];               // 2~4개 (INTEREST_TAGS 어휘 우선)
  mealSlot: MealSlot;
  estimatedDurationMinutes: number;
  estimatedCost: number;              // 현지 통화, 1인 기준
  timePreference: 'morning' | 'afternoon' | 'evening' | 'anytime';
  aiConfidence: number;               // 0~1, AI 자기 확신도 (추천 시 부여, 검증 후에도 보존)
  placeConfidence: PlaceConfidence;   // 검증 파이프라인 전용
  timeVector: TimeProfile;            // 6구간 적합도
  weatherSensitivity: number;         // 0=실내, 1=실외
  dataSource: 'google' | 'nominatim' | 'ai';
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  businessHours: string | null;
  closedDays: string | null;
  rating: number | null;
  googlePlaceId: string | null;
  verified: boolean;                  // Google Places 정밀 검증 통과 여부
  areaId: string;                     // 소속 2차 군집 ID (FK → cluster_areas)
  nodeScore?: number;                 // soft score 결과
  totalScore?: number;                // 최종 종합 점수
}

// ─── v4 사용자 프로필 ───────────────────────────────────────────────────────

export interface PersonalityTags {
  socialEnergy?: 'high' | 'low';
  noveltySeeking?: 'high' | 'low';
  planningStyle?: 'structured' | 'spontaneous';
  groupHarmony?: 'high' | 'low';
  comfortNeed?: 'high' | 'low';
}

/** 기존 FullProfileInput 확장 — planner 전용 */
export interface PlannerUserProfile {
  travelPace: string;
  budgetRange: string;
  companion: string;
  stamina: string;
  morningType: string;
  adventureLevel?: string;
  foodPreference: string[];
  interests: string[];
  specialNote?: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nightComfort: number;               // 0~1
  maxWalkingMinutes: number | null;   // null=제한없음
  wishedActivities: string[];
  personality?: PersonalityTags;      // Big Five → 행동 태그 (personalityMapper에서 변환)
}

// ─── Multi-Region 파이프라인 ─────────────────────────────────────────────────

/** Day별 region 배정 결과 (regionAllocator → pipeline 입력) */
export interface RegionDayAssignment {
  dayNumber: number;
  region: Region;
  areas: Area[];
}

/** 광역 그룹 (규슈 → [후쿠오카, 기타큐슈, ...]) */
export interface RegionGroup {
  id: string;
  groupName: string;
  groupNameKo: string;
  country: string;
  regionIds: string[];
  centerLat: number | null;
  centerLon: number | null;
}

/** Region 간 이동 시간 */
export interface RegionTravelTime {
  id: string;
  fromRegionId: string;
  toRegionId: string;
  mode: string;              // 'shinkansen', 'jr', 'bus', 'car', 'ferry'
  durationMinutes: number;
  costJpy: number | null;
  note: string | null;
}

// ─── 스케줄링 결과 ──────────────────────────────────────────────────────────

/** timeCalculator 출력: PlaceCandidate에 시간/이동 정보 추가 */
export interface ScheduledPlace extends PlaceCandidate {
  startTime: string;            // "09:00"
  endTime: string;              // "10:30"
  transitMode: string;          // "walk" | "public" | "car" | "taxi"
  transitDurationMin: number;
  transitSummary: string | null;
  dayNumber: number;
  orderIndex: number;
}

// ─── 파이프라인 이벤트 (스트리밍용) ─────────────────────────────────────────

export type StreamEvent =
  | { type: 'progress'; message: string }
  | { type: 'day_areas'; dayNumber: number; areas: string[] }
  | { type: 'places_received'; area: string; count: number }
  | { type: 'filtered'; before: number; after: number }
  | { type: 'verified'; verified: number; failed: number }
  | { type: 'day_schedule'; dayNumber: number; places: string[] }
  | { type: 'pool_insufficient'; dayNumber: number; available: number; minimum: number; supplementedFrom?: string }
  | { type: 'complete'; items: import('@/types/database').TripItem[] }

// ─── 디버그 로그 ────────────────────────────────────────────────────────────

export interface DebugLog {
  dayAssignments: { dayNumber: number; areas: string[] }[];
  aiCalls: { area: string; category: string; count: number; costUSD: number }[];
  filterStats: { area: string; before: number; after: number }[];
  verifyStats: { verified: number; failed: number; costUSD: number };
  osrmStats: { success: number; failed: number; fallback: number };
  totalCostUSD: number;
}
