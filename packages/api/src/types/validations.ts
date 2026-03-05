import { z } from 'zod';

// ===== 공통 =====

/** 이메일 정규화: 공백 제거 + 소문자 변환 */
const emailField = z.string().trim().toLowerCase().email('올바른 이메일 형식이 아닙니다.');

// ===== Auth 관련 =====

export const registerSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .max(100, '비밀번호는 100자 이하여야 합니다.'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다.'),
});

// ===== Profile 관련 =====

const personalitySchema = z.object({
  planningStyle: z.enum(['spontaneous', 'structured', 'mixed']),
  pace: z.enum(['relaxed', 'moderate', 'packed']),
  preference: z.enum(['urban', 'nature', 'mixed']),
  companions: z.enum(['solo', 'couple', 'close_friends', 'casual_friends', 'family']).optional(),
  priorities: z.object({
    budget: z.number().int().min(1).max(5),
    experience: z.number().int().min(1).max(5),
    food: z.number().int().min(1).max(5),
    accommodation: z.number().int().min(1).max(5),
  }),
});

const foodPreferencesSchema = z.object({
  cuisines: z.array(z.string().max(100)).max(30),
  priceRange: z.enum(['budget', 'mid', 'premium']),
  dietary: z.array(z.string().max(50)).max(20).optional(),
});

export const updateProfileSchema = z.object({
  personality: personalitySchema.optional(),
  interests: z.array(z.string().max(100)).max(50).optional(),
  foodPreferences: foodPreferencesSchema.optional(),
});

const profileAnswerSchema = z.object({
  questionId: z.string().min(1).max(50),
  answer: z.enum(['yes', 'no', 'doesnt_matter', 'depends', 'custom']),
  customText: z.string().max(500).optional(),
}).refine(
  (data) => data.answer !== 'custom' || (data.customText !== undefined && data.customText.length > 0),
  { message: 'custom 답변에는 customText가 필요합니다.', path: ['customText'] }
);

export const profileCompleteSchema = z.object({
  answers: z.array(profileAnswerSchema).min(1, '최소 1개 이상의 답변이 필요합니다.').max(20),
});

// ===== Trip 관련 =====

export const createTripSchema = z.object({
  destination: z.string().trim().min(1, '목적지를 입력해주세요.').max(200),
  startDate: z.string().datetime({ message: '유효한 날짜 형식이 아닙니다.' }).optional(),
  endDate: z.string().datetime({ message: '유효한 날짜 형식이 아닙니다.' }).optional(),
  companions: z.enum(['solo', 'couple', 'friends', 'family']),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: '종료일은 시작일 이후여야 합니다.', path: ['endDate'] }
);

export const updateTripPlacesSchema = z.object({
  dayNumber: z.number().int().min(1, 'dayNumber는 1 이상이어야 합니다.').max(14, 'dayNumber는 14 이하여야 합니다.'),
  places: z.array(z.object({
    googlePlaceId: z.string().min(1).max(300),
    order: z.number().int().min(0),
    durationMinutes: z.number().int().min(10).max(480).default(60),
    notes: z.string().max(500).optional(),
  })).min(1, '최소 1개 이상의 장소가 필요합니다.').max(20),
});

export const tripIdParamSchema = z.object({
  id: z.string().min(1, '여행 ID가 필요합니다.'),
});

// ===== Place 관련 =====

export const placeIdParamSchema = z.object({
  id: z.string().min(1, '장소 ID가 필요합니다.').max(300),
});

export const placeSearchQuerySchema = z.object({
  query: z.string().trim().min(1, '검색어를 입력해주세요.').max(200),
  destination: z.string().trim().max(200).optional(),
  category: z.enum([
    'restaurant', 'cafe', 'dessert', 'attraction',
    'shopping', 'accommodation', 'nature', 'activity', 'transport',
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ===== 페이지네이션 =====

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ===== 추론 타입 =====

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProfileCompleteInput = z.infer<typeof profileCompleteSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripPlacesInput = z.infer<typeof updateTripPlacesSchema>;
export type TripIdParam = z.infer<typeof tripIdParamSchema>;
export type PlaceIdParam = z.infer<typeof placeIdParamSchema>;
export type PlaceSearchQuery = z.infer<typeof placeSearchQuerySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
