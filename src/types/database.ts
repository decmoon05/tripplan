export type UserRole = 'user' | 'developer' | 'admin';
export type UserPlan = 'free' | 'pro' | 'team';

// ─── 실시간 API 타입 ──────────────────────────────────────────────────────────

export interface DayWeather {
  date: string;       // 'YYYY-MM-DD'
  tempMin: number;    // °C
  tempMax: number;
  description: string;
  icon: string;       // OpenWeather icon code e.g. '01d'
  precipPct: number;  // 강수 확률 0~100
}

export interface WeatherForecast {
  destination: string;
  days: DayWeather[];
  fetchedAt: number;
}

export interface ExchangeRateResult {
  base: string;
  target: string;
  rate: number;       // 1 base = rate target
  inverseRate: number;
  fetchedAt: number;
  isFallback?: boolean;
}

export interface EmergencyContact {
  destination: string;   // 도시/국가명
  country: string;       // 국가명
  currency: string;      // 통화 코드
  embassy: string;       // 한국 대사관 연락처
  police: string;        // 현지 경찰
  ambulance: string;     // 구급대
  fire: string;          // 소방서
  touristPolice?: string; // 관광경찰 (있는 경우)
  hospitalTip?: string;  // 병원/의료 안내
}

export type TripStatus = 'draft' | 'generated' | 'confirmed' | 'completed';

export interface TripAdvisories {
  weather: string;
  safety: string;
  exchangeRate: string;
  holidays: string;
  atmosphere: string;
  disasters: string;
  other: string;
}

export interface SubActivity {
  id: string;
  name: string;
  description: string;
  price: string;
}

export type PlacePreference = 'exclude' | 'revisit' | 'new' | 'hidden';

export interface UserPlacePreference {
  id: string;
  userId: string;
  destination: string;
  placeName: string;
  preference: PlacePreference;
  createdAt: string;
  updatedAt: string;
}

export type TravelPace = 'relaxed' | 'moderate' | 'active';

export type BudgetRange = 'backpacking' | 'budget' | 'moderate' | 'comfort' | 'luxury';

export type CompanionType = 'solo' | 'couple' | 'friends' | 'family' | 'family-kids' | 'business' | 'other';

export type MorningType = 'early' | 'moderate' | 'late';
export type StaminaLevel = 'high' | 'moderate' | 'low';
export type AdventureLevel = 'explorer' | 'balanced' | 'cautious';
export type PhotoStyle = 'sns' | 'casual' | 'minimal';

export interface UserProfile {
  id: string;
  userId: string;
  mbtiStyle: string;
  morningType: MorningType;
  stamina: StaminaLevel;
  adventureLevel: AdventureLevel;
  photoStyle: PhotoStyle;
  travelPace: TravelPace;
  foodPreference: string[];
  budgetRange: BudgetRange;
  companion: CompanionType;
  interests: string[];
  specialNote: string;
  customFoodPreference: string;
  customInterests: string;
  role: UserRole;
  plan: UserPlan;
  createdAt: string;
  updatedAt: string;
}

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  shareToken: string | null;
  tripSummary: string | null;
  advisories: TripAdvisories | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripItem {
  id: string;
  tripId: string;
  dayNumber: number;
  orderIndex: number;
  placeId: string;
  placeNameSnapshot: string;
  category: string;
  startTime: string;
  endTime: string;
  estimatedCost: number;
  currency: string;
  priceConfidence: 'confirmed' | 'estimated';
  notes: string;
  latitude: number | null;
  longitude: number | null;
  reasonTags: string[];
  address: string | null;
  businessHours: string | null;
  closedDays: string | null;
  transitMode: string | null;
  transitDurationMin: number | null;
  transitSummary: string | null;
  verified: boolean;
  googlePlaceId: string | null;
  subActivities: SubActivity[] | null;
  createdAt: string;
}

export interface TravelRoom {
  id: string;
  hostId: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: 'gathering' | 'generating' | 'completed';
  tripId: string | null;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelRoomMember {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  mbtiStyle: string;
  travelPace: TravelPace;
  budgetRange: BudgetRange;
  stamina: string;
  specialNote: string | null;
  joinedAt: string;
}

export type ChecklistCategory = '서류' | '의류' | '전자기기' | '의약품' | '기타';

export interface ChecklistItem {
  id: string;
  tripId: string;
  item: string;
  checked: boolean;
  category: ChecklistCategory;
  createdAt: string;
}

export type ExpenseCategory = '숙박' | '교통' | '식비' | '관광' | '쇼핑' | '기타';

export interface TripExpense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  memo: string | null;
  date: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  tripId: string;
  userId: string;
  enabled: boolean;
  reminderDaysBefore: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomVote {
  id: string;
  roomId: string;
  userId: string;
  topic: string;
  value: string;
  createdAt: string;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface TripRating {
  id: string;
  tripId: string;
  itemId: string;
  userId: string;
  rating: number;
  createdAt: string;
}

export interface TripPhoto {
  id: string;
  tripId: string;
  storagePath: string;
  caption: string | null;
  dayNumber: number | null;
  createdAt: string;
}
