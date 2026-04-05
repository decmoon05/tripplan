'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Route } from 'lucide-react';
import { TimelineCard, type ExpandedSubItem } from './TimelineCard';
import { TransitBadge } from './TransitBadge';
import { AddItemModal } from '@/components/features/trip-editor/AddItemModal';
import { useUpdateItem } from '@/hooks/useTripMutations';
import { useQueryClient } from '@tanstack/react-query';
import type { TripItem } from '@/types/database';
import { formatPriceWithKRW, toKRW } from '@/utils/currency';

interface DayColumnProps {
  tripId: string;
  dayNumber: number;
  date?: string;
  items: TripItem[];
  destination: string;
  expandCache: Record<string, ExpandedSubItem[]>;
  selectionCache: Record<string, Set<number>>;
  onSubItemsFetched: (itemId: string, subItems: ExpandedSubItem[]) => void;
  onSubItemToggle: (itemId: string, subIndex: number, subItem: ExpandedSubItem) => void;
  highlightedItemId?: string | null;
  onItemHover?: (itemId: string | null) => void;
  onItemClick?: (itemId: string) => void;
  isToday?: boolean;
}

export function DayColumn({
  tripId, dayNumber, date, items, destination,
  expandCache, selectionCache,
  onSubItemsFetched, onSubItemToggle,
  highlightedItemId, onItemHover, onItemClick,
  isToday,
}: DayColumnProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // 여행 중이면 오늘 Day로 자동 스크롤
  useEffect(() => {
    if (isToday && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isToday]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState<string | null>(null);
  const updateItem = useUpdateItem(tripId);
  const queryClient = useQueryClient();
  const sortedItems = [...items].sort((a, b) => a.orderIndex - b.orderIndex);

  const handleOptimizeRoute = async () => {
    setIsOptimizing(true);
    setOptimizeMsg(null);
    try {
      const res = await fetch(`/api/v1/trips/${tripId}/optimize-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayNumber }),
      });
      const json = await res.json();
      if (json.success) {
        setOptimizeMsg(json.data.message);
        queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'items'] });
      }
    } catch {
      setOptimizeMsg('동선 최적화에 실패했습니다');
    } finally {
      setIsOptimizing(false);
      setTimeout(() => setOptimizeMsg(null), 4000);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((i) => i.id === active.id);
    const newIndex = sortedItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const activeItem = sortedItems[oldIndex];
    const overItem = sortedItems[newIndex];

    try {
      await updateItem.mutateAsync({ itemId: activeItem.id, updates: { orderIndex: overItem.orderIndex } });
      await updateItem.mutateAsync({ itemId: overItem.id, updates: { orderIndex: activeItem.orderIndex } });
    } catch {
      // invalidation auto-restores server state
    }
  };

  return (
    <section ref={sectionRef} className={`relative ${isToday ? 'scroll-mt-24' : ''}`} id={isToday ? 'today-schedule' : undefined}>
      {/* Day header */}
      <div className="flex items-baseline gap-6 mb-12">
        <h2 className={`text-8xl font-serif font-black leading-none select-none ${isToday ? 'text-orange-500/20' : 'text-black/5'}`}>
          {String(dayNumber).padStart(2, '0')}
        </h2>
        <div className="relative -ml-12">
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-medium tracking-tight">Day {dayNumber}</h3>
            {isToday && (
              <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold animate-pulse">
                📍 오늘
              </span>
            )}
          </div>
          <p className="text-sm text-black/40 font-medium">
            {date ? `${date} · ` : ''}Exploring {destination}
          </p>
        </div>
      </div>

      {/* Timeline with vertical line */}
      {sortedItems.length > 0 ? (
        <div className="space-y-10 ml-6 md:ml-16 border-l-2 border-black/5 pl-10 md:pl-16 py-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-10">
                {sortedItems.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && (
                      <TransitBadge
                        transitMode={item.transitMode}
                        transitDurationMin={item.transitDurationMin}
                        transitSummary={item.transitSummary}
                      />
                    )}
                    <TimelineCard
                      tripId={tripId}
                      item={item}
                      index={i}
                      isLast={i === sortedItems.length - 1}
                      destination={destination}
                      cachedSubItems={expandCache[item.id]}
                      selectedSubItems={selectionCache[item.id]}
                      onSubItemsFetched={onSubItemsFetched}
                      onSubItemToggle={onSubItemToggle}
                      isHighlighted={highlightedItemId === item.id}
                      onHover={onItemHover}
                      onClick={onItemClick}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="space-y-10 ml-6 md:ml-16 border-l-2 border-black/5 pl-10 md:pl-16 py-4">
          <div className="rounded-2xl border-2 border-dashed border-black/10 p-8 text-center text-black/30">
            일정이 없습니다
          </div>
        </div>
      )}

      {/* Add / Optimize buttons */}
      <div className="ml-6 md:ml-16 pl-10 md:pl-16 mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 text-sm text-black/30 hover:text-orange-500 transition font-medium"
        >
          <Plus size={16} />
          장소 추가
        </button>
        {sortedItems.length >= 2 && (
          <button
            type="button"
            onClick={handleOptimizeRoute}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 text-xs text-black/30 hover:text-orange-500 transition font-medium disabled:opacity-50"
            title="동선 최적화 (최단 경로)"
          >
            <Route size={14} />
            {isOptimizing ? '최적화 중...' : '동선 최적화'}
          </button>
        )}
        {optimizeMsg && (
          <span className="text-xs text-orange-600 font-medium">{optimizeMsg}</span>
        )}
      </div>

      <AddItemModal
        tripId={tripId}
        dayNumber={dayNumber}
        existingCount={sortedItems.length}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />
    </section>
  );
}
