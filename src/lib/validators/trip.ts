import { z } from 'zod/v4';
import { getDayCount } from '@/utils/date';

const MAX_TRIP_DAYS = 30;

export const createTripSchema = z
  .object({
    destination: z
      .string()
      .min(1, '목적지를 입력해주세요')
      .max(100)
      .transform((v) => v.replace(/[<>]/g, '').trim()),
    startDate: z.string().min(1, '출발일을 선택해주세요'),
    endDate: z.string().min(1, '귀국일을 선택해주세요'),
  })
  .refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    { message: '귀국일은 출발일 이후여야 합니다', path: ['endDate'] },
  )
  .refine(
    (data) => getDayCount(data.startDate, data.endDate) <= MAX_TRIP_DAYS,
    { message: `여행 기간은 최대 ${MAX_TRIP_DAYS}일까지 가능합니다`, path: ['endDate'] },
  );

export type CreateTripInput = z.infer<typeof createTripSchema>;
