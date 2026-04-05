'use client';

import { useTrips } from '@/hooks/useTrips';
import Link from 'next/link';
import { MapPin, Calendar, ArrowRight } from 'lucide-react';

export function TripHistory() {
  const { data: trips = [], isLoading } = useTrips();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="w-8 h-8 text-black/20 mx-auto mb-3" />
        <p className="text-sm text-black/40">아직 여행 기록이 없어요</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-orange-500 hover:underline">
          첫 여행 계획하기
        </Link>
      </div>
    );
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: '초안', color: 'bg-black/5 text-black/40' },
    generated: { label: '생성됨', color: 'bg-orange-500/10 text-orange-600' },
    confirmed: { label: '확정', color: 'bg-green-500/10 text-green-600' },
  };

  const sortedTrips = [...trips].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {sortedTrips.map((trip) => {
        const status = STATUS_LABELS[trip.status] ?? STATUS_LABELS.draft;
        return (
          <Link
            key={trip.id}
            href={`/trips/${trip.id}`}
            className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-black/5 hover:border-orange-500/20 hover:shadow-sm transition-all group"
          >
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-semibold text-sm text-black truncate">{trip.destination}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-black/40">
                <Calendar className="w-3 h-3" />
                <span>{trip.startDate} — {trip.endDate}</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-black/20 group-hover:text-orange-500 transition-colors flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
