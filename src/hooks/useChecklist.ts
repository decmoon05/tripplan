'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChecklistItem } from '@/types/database';

async function fetchChecklist(tripId: string): Promise<ChecklistItem[]> {
  const res = await fetch(`/api/v1/trips/${tripId}/checklist`);
  if (!res.ok) throw new Error('체크리스트를 불러오는데 실패했습니다');
  const json = await res.json();
  return (json.data ?? []).map((item: Record<string, unknown>) => ({
    id: item.id,
    tripId: item.trip_id,
    item: item.item,
    checked: item.checked,
    category: item.category,
    createdAt: item.created_at,
  })) as ChecklistItem[];
}

export function useChecklist(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'checklist'],
    queryFn: () => fetchChecklist(tripId),
    enabled: !!tripId,
  });
}

export function useAddChecklistItem(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, category }: { item: string; category: string }) => {
      const res = await fetch(`/api/v1/trips/${tripId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, category }),
      });
      if (!res.ok) throw new Error('항목 추가에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'checklist'] });
    },
  });
}

export function useToggleChecklistItem(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const res = await fetch(`/api/v1/trips/${tripId}/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked }),
      });
      if (!res.ok) throw new Error('체크 상태 변경에 실패했습니다');
      return res.json();
    },
    onMutate: async ({ itemId, checked }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'checklist'] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['trips', tripId, 'checklist']);
      queryClient.setQueryData<ChecklistItem[]>(['trips', tripId, 'checklist'], (old) =>
        old?.map((item) => item.id === itemId ? { ...item, checked } : item) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'checklist'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'checklist'] });
    },
  });
}

export function useDeleteChecklistItem(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/v1/trips/${tripId}/checklist/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('항목 삭제에 실패했습니다');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'checklist'] });
    },
  });
}
