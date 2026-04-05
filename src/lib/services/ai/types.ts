import type { TripItem, PlacePreference, TripAdvisories } from '@/types/database';
import type { FullProfileInput } from '@/lib/validators/profile';

export interface GenerateInput {
  destination: string;
  startDate: string;
  endDate: string;
}

export interface PlacePreferenceInput {
  placeName: string;
  preference: PlacePreference;
}

/** Google Places에서 검증된 장소 정보 */
export interface VerifiedPlace {
  googlePlaceId: string;
  displayName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  businessHours: string | null;
  closedDays: string | null;
  category: string;
}

/** 이전 여행에서 방문한 장소 + 사용자 평가 */
export interface PreviousVisit {
  placeNameSnapshot: string;
  category: string;
  googlePlaceId: string | null;
  rating: number | null;  // 1~5, null이면 미평가
  memo: string | null;
}

export interface AIGenerateResult {
  items: TripItem[];
  tripSummary?: string;
  advisories?: TripAdvisories;
}

export interface AITripMetadata {
  tripSummary: string;
  advisories: TripAdvisories;
}

export interface AIProvider {
  generateItinerary(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
  ): Promise<AIGenerateResult>;
}

export type AIProviderType = 'openai' | 'claude' | 'gemini' | 'mock';

// --- Streaming support (Gemini) ---

export interface GroundingSource {
  title: string;
  url: string;
}

export type StreamChunk =
  | { type: 'progress'; message: string }
  | { type: 'grounding'; sources: GroundingSource[] }
  | { type: 'partial_item'; item: AIGeneratedItem }
  | { type: 'complete'; result: AIGenerateResult }
  | { type: 'stream_result'; data: unknown };

export interface AIProviderStreaming extends AIProvider {
  generateItineraryStream(
    profile: FullProfileInput,
    input: GenerateInput,
    placePreferences?: PlacePreferenceInput[],
    verifiedPlaces?: VerifiedPlace[],
    previousVisits?: PreviousVisit[],
  ): AsyncGenerator<StreamChunk>;
}

export interface FeasibilityOption {
  id: string;                     // 'A', 'B', 'C'
  label: string;                  // 한국어 라벨
  action: 'proceed_limited' | 'remove_request' | 'suggest_destination' | 'modify_request';
  suggestedDestination?: string;  // suggest_destination일 때만
  modifiedNote?: string;          // 선택 시 specialNote 교체 값
}

export interface FeasibilityCheckResult {
  status: 'no_issues' | 'has_concerns';
  message: string | null;
  options: FeasibilityOption[];
}

export interface AIGeneratedItem {
  dayNumber: number;
  orderIndex: number;
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
  activityLevel: 'light' | 'moderate' | 'intense';
  reasonTags: string[];
  address: string | null;
  businessHours: string | null;
  closedDays: string | null;
  transitMode: string | null;
  transitDurationMin: number | null;
  transitSummary: string | null;
  verified?: boolean;
  googlePlaceId?: string | null;
}
