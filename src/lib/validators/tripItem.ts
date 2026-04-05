import { z } from 'zod/v4';

export const createTripItemSchema = z.object({
  dayNumber: z.number().int().min(1).max(30),
  orderIndex: z.number().int().min(0),
  placeId: z.string().min(1).max(200),
  placeNameSnapshot: z.string().min(1, '장소명을 입력해주세요').max(200).transform((v) => v.replace(/[<>]/g, '').trim()),
  category: z.enum(['attraction', 'restaurant', 'cafe', 'shopping', 'transport', 'hotel']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '시간 형식이 올바르지 않습니다'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '시간 형식이 올바르지 않습니다'),
  estimatedCost: z.number().int().min(0).max(10_000_000).default(0),
  notes: z.string().max(1000).transform((v) => v.replace(/[<>]/g, '')).default(''),
});

export const updateTripItemSchema = z.object({
  itemId: z.string().uuid('유효하지 않은 항목 ID입니다'),
  placeNameSnapshot: z.string().min(1).max(200).transform((v) => v.replace(/[<>]/g, '').trim()).optional(),
  category: z.enum(['attraction', 'restaurant', 'cafe', 'shopping', 'transport', 'hotel']).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  estimatedCost: z.number().int().min(0).max(10_000_000).optional(),
  currency: z.string().min(3).max(3).optional(),
  priceConfidence: z.enum(['confirmed', 'estimated']).optional(),
  notes: z.string().max(1000).transform((v) => v.replace(/[<>]/g, '')).optional(),
  orderIndex: z.number().int().min(0).optional(),
  dayNumber: z.number().int().min(1).max(30).optional(),
  address: z.string().max(500).nullable().optional(),
  businessHours: z.string().max(100).nullable().optional(),
  closedDays: z.string().max(100).nullable().optional(),
  transitMode: z.enum(['walk', 'bus', 'taxi', 'subway', 'train', 'bicycle', 'drive', 'flight', 'ferry']).nullable().optional(),
  transitDurationMin: z.number().int().min(0).nullable().optional(),
  transitSummary: z.string().max(200).nullable().optional(),
});

export const updateTripSchema = z.object({
  destination: z.string().min(1).max(100).transform((v) => v.replace(/[<>]/g, '').trim()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'generated', 'confirmed', 'completed']).optional(),
}).strict().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  { message: '귀국일은 출발일 이후여야 합니다', path: ['endDate'] },
);

export type CreateTripItemInput = z.infer<typeof createTripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
