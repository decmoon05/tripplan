// 공유 타입 정의 — 백엔드와 프론트엔드에서 함께 사용

// ===== 사용자 관련 =====

export interface UserProfile {
  id: string;
  personality: PersonalityProfile;
  interests: string[];
  foodPreferences: FoodPreferences;
  updatedAt: string;
}

export interface PersonalityProfile {
  planningStyle: 'spontaneous' | 'structured' | 'mixed';
  pace: 'relaxed' | 'moderate' | 'packed';
  preference: 'urban' | 'nature' | 'mixed';
  companions?: CompanionType;
  priorities: TravelPriorities;
}

export type CompanionType = 'solo' | 'couple' | 'close_friends' | 'casual_friends' | 'family';

export interface FoodPreferences {
  cuisines: string[];
  priceRange: 'budget' | 'mid' | 'premium';
  dietary?: string[];
}

export interface TravelPriorities {
  budget: 1 | 2 | 3 | 4 | 5;
  experience: 1 | 2 | 3 | 4 | 5;
  food: 1 | 2 | 3 | 4 | 5;
  accommodation: 1 | 2 | 3 | 4 | 5;
}

// ===== 질문/답변 관련 =====

export type AnswerOption = 'yes' | 'no' | 'doesnt_matter' | 'depends' | 'custom';

export interface ProfileQuestion {
  id: string;
  text: string;
  category: 'personality' | 'food' | 'activity' | 'social';
  answerOptions: AnswerOption[];
}

export interface ProfileAnswer {
  questionId: string;
  answer: AnswerOption;
  customText?: string; // answer === 'custom' 일 때 사용
}

// ===== 여행 관련 =====

export interface Trip {
  id: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  companions: CompanionType;
  status: 'draft' | 'confirmed' | 'completed';
  days: TripDay[];
  issues?: TravelIssue[];
  createdAt: string;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date?: string;
  places: TripPlace[];
}

export interface TripPlace {
  id: string;
  order: number;
  durationMinutes: number;
  notes?: string;
  place: Place;
}

// ===== 장소 관련 =====

export interface Place {
  googlePlaceId: string;
  name: string;
  category: PlaceCategory;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  address?: string;
  openingHours?: string[];
  lat: number;
  lng: number;
  photoUrl?: string;
  website?: string;
}

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'dessert'
  | 'attraction'
  | 'shopping'
  | 'accommodation'
  | 'nature'
  | 'activity'
  | 'transport';

// ===== 이슈 관련 =====

export interface TravelIssue {
  id: string;
  placeId?: string;
  issueType: 'construction' | 'closure' | 'event' | 'safety';
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

// ===== API 응답 형식 =====

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
