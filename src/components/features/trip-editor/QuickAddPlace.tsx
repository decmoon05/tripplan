'use client';

import { useState } from 'react';
import { useAddItem } from '@/hooks/useTripMutations';
import { generateId } from '@/utils/id';

interface QuickAddPlaceProps {
  tripId: string;
  dayCount: number;
}

export function QuickAddPlace({ tripId, dayCount }: QuickAddPlaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedDay, setSelectedDay] = useState(1);
  const [category, setCategory] = useState('restaurant');
  const addItem = useAddItem(tripId);

  const handleAdd = async () => {
    if (!placeName.trim()) return;

    const notes = linkUrl.trim() ? `참고: ${linkUrl.trim()}` : '';

    try {
      await addItem.mutateAsync({
        dayNumber: selectedDay,
        orderIndex: 99, // 마지막에 추가
        placeId: generateId('place'),
        placeNameSnapshot: placeName.trim(),
        category,
        startTime: '12:00',
        endTime: '13:00',
        estimatedCost: 0,
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
      setPlaceName('');
      setLinkUrl('');
      setIsOpen(false);
    } catch {
      // error shown via mutation state
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-4 w-full rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
      >
        + 인스타/블로그에서 본 장소 추가하기
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-primary)] bg-blue-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">장소 빠른 추가</span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          닫기
        </button>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder="장소 이름 (예: 이치란 라멘 본점)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
        />

        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="참고 링크 (인스타/블로그/지도 URL, 선택사항)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
        />

        <div className="flex gap-2">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="restaurant">식당</option>
            <option value="cafe">카페</option>
            <option value="attraction">관광</option>
            <option value="shopping">쇼핑</option>
            <option value="transport">이동</option>
            <option value="hotel">숙소</option>
          </select>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!placeName.trim() || addItem.isPending}
            className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {addItem.isPending ? '추가 중...' : '추가'}
          </button>
        </div>

        {addItem.isError && (
          <p className="text-xs text-red-500">{addItem.error?.message || '추가 실패'}</p>
        )}
      </div>
    </div>
  );
}
