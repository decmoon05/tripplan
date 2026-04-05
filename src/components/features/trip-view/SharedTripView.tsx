'use client';

import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { TimelineView } from './TimelineView';
import { AdvisoriesPanel } from './AdvisoriesPanel';
import type { Trip, TripItem } from '@/types/database';
import { getDayCount } from '@/utils/date';

interface SharedTripViewProps {
  trip: Trip;
  items: TripItem[];
}

export function SharedTripView({ trip, items }: SharedTripViewProps) {
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-black">
      {/* Header */}
      <div className="bg-white border-b border-black/5 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-600 rounded-full px-3 py-1 text-xs font-semibold">
            <MapPin size={12} />
            공유된 여행
          </span>
          <Link
            href="/onboarding"
            className="text-xs text-black/40 hover:text-orange-500 transition font-medium"
          >
            나도 만들기
          </Link>
        </div>
      </div>

      <div className="px-4 md:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5 overflow-hidden mb-8"
          >
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <h1 className="text-3xl md:text-5xl font-serif font-medium tracking-tight mb-2">
                {trip.destination}
              </h1>
              <p className="text-sm text-black/40">
                {trip.startDate} ~ {trip.endDate} ({dayCount}일)
              </p>

              {trip.tripSummary && (
                <p className="mt-4 text-sm md:text-base text-black/60 leading-relaxed">
                  {trip.tripSummary}
                </p>
              )}
            </div>
          </motion.div>

          {/* Advisories */}
          {trip.advisories && (
            <div className="mb-8">
              <AdvisoriesPanel advisories={trip.advisories} />
            </div>
          )}

          {/* Timeline */}
          <TimelineView trip={trip} items={items} />

          {/* CTA */}
          <div className="mt-16 text-center">
            <p className="text-sm text-black/40 mb-3">나도 AI 맞춤 여행 일정을 만들어보세요</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-black text-white font-bold text-sm uppercase tracking-wider px-8 py-3 rounded-full hover:bg-black/80 transition"
            >
              여행 시작하기
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
