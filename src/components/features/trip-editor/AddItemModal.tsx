'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAddItem } from '@/hooks/useTripMutations';
import { generateId } from '@/utils/id';

interface AddItemModalProps {
  tripId: string;
  dayNumber: number;
  existingCount: number;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'attraction', label: '관광' },
  { value: 'restaurant', label: '식당' },
  { value: 'cafe', label: '카페' },
  { value: 'shopping', label: '쇼핑' },
  { value: 'transport', label: '이동' },
  { value: 'hotel', label: '숙소' },
];

export function AddItemModal({ tripId, dayNumber, existingCount, isOpen, onClose }: AddItemModalProps) {
  const addItem = useAddItem(tripId);
  const [placeName, setPlaceName] = useState('');
  const [category, setCategory] = useState('attraction');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    try {
      await addItem.mutateAsync({
        dayNumber,
        orderIndex: existingCount,
        placeId: generateId('place'),
        placeNameSnapshot: placeName,
        category,
        startTime,
        endTime,
        estimatedCost: Number(estimatedCost) || 0,
        currency: 'KRW',
        priceConfidence: 'estimated' as const,
        notes,
        address: null,
        businessHours: null,
        closedDays: null,
        transitMode: null,
        transitDurationMin: null,
        transitSummary: null,
        verified: true,
        googlePlaceId: null,
        subActivities: null,
      });

      onClose();
      setPlaceName('');
      setCategory('attraction');
      setStartTime('10:00');
      setEndTime('11:00');
      setEstimatedCost('0');
      setNotes('');
    } catch {
      // 에러는 mutation 상태(addItem.isError)로 UI에 표시
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Day ${dayNumber} 일정 추가`}>
      <div className="space-y-4">
        <div>
          <label htmlFor="add-place" className="block text-sm font-medium">
            장소명
          </label>
          <input
            id="add-place"
            type="text"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="예: 센소지, 맛집 이름"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="add-category" className="block text-sm font-medium">
            카테고리
          </label>
          <select
            id="add-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-start" className="block text-sm font-medium">
              시작 시간
            </label>
            <input
              id="add-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="add-end" className="block text-sm font-medium">
              종료 시간
            </label>
            <input
              id="add-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="add-cost" className="block text-sm font-medium">
            예상 비용
          </label>
          <input
            id="add-cost"
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="add-notes" className="block text-sm font-medium">
            메모
          </label>
          <textarea
            id="add-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
          />
        </div>

        {addItem.isError && (
          <p className="text-sm text-red-500">
            {addItem.error?.message || '추가에 실패했습니다'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleAdd} disabled={!placeName.trim() || addItem.isPending}>
            {addItem.isPending ? '추가 중...' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
