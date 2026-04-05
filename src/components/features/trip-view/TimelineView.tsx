'use client';

import { useCallback, useState } from 'react';
import { DayColumn } from './DayColumn';
import type { ExpandedSubItem } from './TimelineCard';
import type { Trip, TripItem } from '@/types/database';
import { getDayCount, addDays } from '@/utils/date';
import { formatPriceWithKRW, toKRW } from '@/utils/currency';
import { DollarSign } from 'lucide-react';

interface TimelineViewProps {
  trip: Trip;
  items: TripItem[];
  highlightedItemId?: string | null;
  onItemHover?: (itemId: string | null) => void;
  onItemClick?: (itemId: string) => void;
}

export function TimelineView({ trip, items, highlightedItemId, onItemHover, onItemClick }: TimelineViewProps) {
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  // AI detail cache (persists across tab switches)
  const [expandCache, setExpandCache] = useState<Record<string, ExpandedSubItem[]>>({});
  const [selectionCache, setSelectionCache] = useState<Record<string, Set<number>>>({});

  const handleSubItemsFetched = useCallback((itemId: string, subItems: ExpandedSubItem[]) => {
    setExpandCache((prev) => ({ ...prev, [itemId]: subItems }));
  }, []);

  const handleSubItemToggle = useCallback((itemId: string, subIndex: number, subItem: ExpandedSubItem) => {
    setSelectionCache((prev) => {
      const current = new Set(prev[itemId] || []);
      const allSubs = expandCache[itemId] || [];

      // Radio behavior for grouped items
      if (subItem.group) {
        allSubs.forEach((s, i) => {
          if (s.group === subItem.group && i !== subIndex) {
            current.delete(i);
          }
        });
      }

      if (current.has(subIndex)) {
        current.delete(subIndex);
      } else {
        current.add(subIndex);
      }

      return { ...prev, [itemId]: current };
    });
  }, [expandCache]);

  const groupedByDay: Record<number, TripItem[]> = {};
  items.forEach((item) => {
    if (!groupedByDay[item.dayNumber]) groupedByDay[item.dayNumber] = [];
    groupedByDay[item.dayNumber].push(item);
  });

  const currencies = new Set(items.map((i) => i.currency || 'KRW'));
  const isSingleCurrency = currencies.size <= 1;
  const totalCurrency = isSingleCurrency ? (items[0]?.currency || 'KRW') : 'KRW';
  const totalCost = isSingleCurrency
    ? items.reduce((sum, item) => sum + item.estimatedCost, 0)
    : items.reduce((sum, item) => sum + (toKRW(item.estimatedCost, item.currency || 'KRW') ?? item.estimatedCost), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-20">
      {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
        <DayColumn
          key={day}
          tripId={trip.id}
          dayNumber={day}
          date={addDays(trip.startDate, day - 1)}
          items={groupedByDay[day] || []}
          destination={trip.destination}
          expandCache={expandCache}
          selectionCache={selectionCache}
          onSubItemsFetched={handleSubItemsFetched}
          onSubItemToggle={handleSubItemToggle}
          highlightedItemId={highlightedItemId}
          onItemHover={onItemHover}
          onItemClick={onItemClick}
        />
      ))}

      {/* Total cost card */}
      <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-orange-500" />
              <span className="text-sm font-semibold text-black">총 예상 비용</span>
            </div>
            <p className="text-xs text-black/40">
              입장료 + 식비 + 교통비 + 카페 등 포함 (숙박비 별도)
            </p>
          </div>
          <span className="text-2xl font-serif font-medium text-orange-600">
            {formatPriceWithKRW(totalCost, totalCurrency, 'estimated')}
          </span>
        </div>
      </div>
    </div>
  );
}
