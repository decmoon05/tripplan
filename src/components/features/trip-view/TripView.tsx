'use client';

import { useState, useCallback } from 'react';
import { TimelineView } from './TimelineView';
import { MapView } from '@/components/features/map/MapView';
import type { Trip, TripItem } from '@/types/database';
import { getDayCount } from '@/utils/date';

interface TripViewProps {
  trip: Trip;
  items: TripItem[];
}

type MobileView = 'timeline' | 'map';

export function TripView({ trip, items }: TripViewProps) {
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('timeline');
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  const handleItemHover = useCallback((itemId: string | null) => {
    setHighlightedItemId(itemId);
  }, []);

  const handleMarkerClick = useCallback((itemId: string) => {
    setHighlightedItemId(itemId);
    const el = document.getElementById(`timeline-card-${itemId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleItemClick = useCallback((itemId: string) => {
    setHighlightedItemId(itemId);
  }, []);

  return (
    <div className="h-screen bg-[#f5f5f5] text-black flex flex-col selection:bg-orange-500/30">
      {/* Mobile Tab Toggle */}
      <div className="md:hidden flex border-b border-black/5 bg-white sticky top-[73px] z-40">
        <button
          type="button"
          onClick={() => setMobileView('timeline')}
          className={`flex-1 py-4 text-xs uppercase tracking-widest font-bold transition-all ${
            mobileView === 'timeline'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-black/40'
          }`}
        >
          Timeline
        </button>
        <button
          type="button"
          onClick={() => setMobileView('map')}
          className={`flex-1 py-4 text-xs uppercase tracking-widest font-bold transition-all ${
            mobileView === 'map'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-black/40'
          }`}
        >
          Map
        </button>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline */}
        <main className={`flex-1 min-w-0 overflow-y-auto p-6 md:p-12 space-y-12 ${mobileView === 'map' ? 'hidden md:block' : 'block'}`}>
          <TimelineView
            trip={trip}
            items={items}
            highlightedItemId={highlightedItemId}
            onItemHover={handleItemHover}
            onItemClick={handleItemClick}
          />
        </main>

        {/* Map */}
        <aside className={`flex-1 min-w-0 bg-gray-100 relative ${mobileView === 'timeline' ? 'hidden md:block' : 'block'}`}>
          <MapView
            items={items}
            dayCount={dayCount}
            highlightedItemId={highlightedItemId}
            onMarkerClick={handleMarkerClick}
            className="h-full"
          />
        </aside>
      </div>
    </div>
  );
}
