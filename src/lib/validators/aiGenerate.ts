import { z } from 'zod/v4';
import { createTripSchema } from '@/lib/validators/trip';
import { fullProfileSchema } from '@/lib/validators/profile';

const placePreferenceSchema = z.object({
  placeName: z.string().min(1),
  preference: z.enum(['exclude', 'revisit', 'new', 'hidden']),
});

export const generateRequestSchema = z.object({
  tripId: z.string().min(1, 'tripId는 필수입니다'),
  profile: fullProfileSchema,
  tripInput: createTripSchema,
  placePreferences: z.array(placePreferenceSchema).optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
