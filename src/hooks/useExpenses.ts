'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TripExpense, ExpenseCategory } from '@/types/database';

function mapExpense(raw: Record<string, unknown>): TripExpense {
  return {
    id: raw.id as string,
    tripId: raw.trip_id as string,
    category: raw.category as ExpenseCategory,
    amount: Number(raw.amount),
    currency: raw.currency as string,
    memo: raw.memo as string | null,
    date: raw.date as string | null,
    createdAt: raw.created_at as string,
  };
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'expenses'],
    queryFn: async (): Promise<TripExpense[]> => {
      const res = await fetch(`/api/v1/trips/${tripId}/expenses`);
      if (!res.ok) throw new Error('지출 내역을 불러오는데 실패했습니다');
      const json = await res.json();
      return (json.data ?? []).map(mapExpense);
    },
    enabled: !!tripId,
  });
}

export function useAddExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      category: ExpenseCategory;
      amount: number;
      currency: string;
      memo?: string;
      date?: string;
    }) => {
      const res = await fetch(`/api/v1/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('지출 추가에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    },
  });
}

export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expenseId,
      updates,
    }: {
      expenseId: string;
      updates: Partial<Omit<TripExpense, 'id' | 'tripId' | 'createdAt'>>;
    }) => {
      const res = await fetch(`/api/v1/trips/${tripId}/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('지출 수정에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    },
  });
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await fetch(`/api/v1/trips/${tripId}/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('지출 삭제에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'expenses'] });
    },
  });
}
