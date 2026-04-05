import type { Trip } from '@/types/database';

export const mockTrips: Trip[] = [
  {
    id: 'mock-trip-tokyo',
    userId: 'mock-user-1',
    destination: '도쿄',
    startDate: '2026-04-01',
    endDate: '2026-04-03',
    status: 'generated',
    shareToken: null,
    tripSummary: null,
    advisories: null,
    createdAt: '2026-03-09T00:00:00Z',
    updatedAt: '2026-03-09T00:00:00Z',
  },
  {
    id: 'mock-trip-jeju',
    userId: 'mock-user-2',
    destination: '제주',
    startDate: '2026-05-10',
    endDate: '2026-05-12',
    status: 'confirmed',
    shareToken: null,
    tripSummary: null,
    advisories: null,
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
  },
];
