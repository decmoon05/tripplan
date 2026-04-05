import { z } from 'zod/v4';

export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

export const TRAVEL_PACES = ['relaxed', 'moderate', 'active'] as const;

export const BUDGET_RANGES = ['budget', 'moderate', 'luxury'] as const;

export const FOOD_PREFERENCES = [
  'vegetarian',
  'vegan',
  'halal',
  'no-seafood',
  'no-spicy',
  'no-dairy',
  'no-gluten',
  'no-pork',
] as const;

export const COMPANION_TYPES = ['solo', 'couple', 'friends', 'family', 'family-kids', 'business', 'other'] as const;

export const ARRIVAL_TIMES = ['morning', 'afternoon', 'evening', 'undecided'] as const;
export type ArrivalTime = (typeof ARRIVAL_TIMES)[number];

export const INTEREST_TAGS = [
  'anime', 'drama', 'kpop', 'jpop', 'film-location',
  'history', 'art', 'museum', 'architecture',
  'nature', 'hiking', 'beach', 'hot-spring',
  'theme-park', 'nightlife', 'festival',
  'local-food', 'street-food', 'fine-dining', 'cooking-class',
  'photo-spot', 'shopping-luxury', 'shopping-vintage', 'flea-market',
  'temple', 'shrine', 'religious',
  'sports', 'surfing', 'skiing', 'golf',
] as const;

// 라이프스타일 (간접 프로파일링)
export const lifestyleSchema = z.object({
  morningType: z.enum(['early', 'moderate', 'late']),
  stamina: z.enum(['high', 'moderate', 'low']),
  adventureLevel: z.enum(['explorer', 'balanced', 'cautious']),
  photoStyle: z.enum(['sns', 'casual', 'minimal']),
});

// 온보딩용 (프로필 저장) — 개인 성향, 한 번만
export const profileSchema = z.object({
  mbtiStyle: z.literal(MBTI_TYPES),
  lifestyle: lifestyleSchema,
  foodPreference: z.array(z.enum(FOOD_PREFERENCES)).max(8),
  interests: z.array(z.enum(INTEREST_TAGS)).max(10).default([]),
  customFoodPreference: z.string().max(100).default(''),
  customInterests: z.string().max(200).default(''),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// 여행별 설정 (매번 질문)
export const tripPreferencesSchema = z.object({
  travelPace: z.enum(TRAVEL_PACES),
  budgetRange: z.enum(BUDGET_RANGES),
  companion: z.enum(COMPANION_TYPES).default('solo'),
  specialNote: z.string().max(500).default(''),
  arrivalTime: z.enum(ARRIVAL_TIMES).default('undecided'),
  hotelArea: z.string().max(100).default(''),
});

export type TripPreferencesInput = z.infer<typeof tripPreferencesSchema>;

// AI 생성 시 프로필 + 여행설정 통합
export const fullProfileSchema = profileSchema.merge(tripPreferencesSchema);

export type FullProfileInput = z.infer<typeof fullProfileSchema>;
