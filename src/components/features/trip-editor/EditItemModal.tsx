'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUpdateItem } from '@/hooks/useTripMutations';
import type { TripItem } from '@/types/database';

interface EditItemModalProps {
  tripId: string;
  item: TripItem;
  isOpen: boolean;
  onClose: () => void;
}

export function EditItemModal({ tripId, item, isOpen, onClose }: EditItemModalProps) {
  const updateItem = useUpdateItem(tripId);
  const [placeName, setPlaceName] = useState(item.placeNameSnapshot);
  const [startTime, setStartTime] = useState(item.startTime);
  const [endTime, setEndTime] = useState(item.endTime);
  const [estimatedCost, setEstimatedCost] = useState(String(item.estimatedCost));
  const [notes, setNotes] = useState(item.notes);
  const [address, setAddress] = useState(item.address || '');
  const [businessHours, setBusinessHours] = useState(item.businessHours || '');
  const [closedDays, setClosedDays] = useState(item.closedDays || '');

  const handleSave = async () => {
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          placeNameSnapshot: placeName,
          startTime,
          endTime,
          estimatedCost: Number(estimatedCost) || 0,
          notes,
          address: address || null,
          businessHours: businessHours || null,
          closedDays: closedDays || null,
        },
      });
      onClose();
    } catch {
      // 에러는 mutation 상태(updateItem.isError)로 UI에 표시
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="일정 수정">
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-place" className="block text-sm font-medium">
            장소명
          </label>
          <input
            id="edit-place"
            type="text"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-start" className="block text-sm font-medium">
              시작 시간
            </label>
            <input
              id="edit-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-end" className="block text-sm font-medium">
              종료 시간
            </label>
            <input
              id="edit-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-cost" className="block text-sm font-medium">
            예상 비용 ({item.currency || 'KRW'})
          </label>
          <input
            id="edit-cost"
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-address" className="block text-sm font-medium">
            주소
          </label>
          <input
            id="edit-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="현지어 주소 (Google Maps 검색용)"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-hours" className="block text-sm font-medium">
              영업시간
            </label>
            <input
              id="edit-hours"
              type="text"
              value={businessHours}
              onChange={(e) => setBusinessHours(e.target.value)}
              placeholder="09:00-17:00"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-closed" className="block text-sm font-medium">
              휴무일
            </label>
            <input
              id="edit-closed"
              type="text"
              value={closedDays}
              onChange={(e) => setClosedDays(e.target.value)}
              placeholder="월요일, 연중무휴"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-notes" className="block text-sm font-medium">
            메모
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        {updateItem.isError && (
          <p className="text-sm text-red-500">
            {updateItem.error?.message || '저장에 실패했습니다'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!placeName.trim() || updateItem.isPending}>
            {updateItem.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
