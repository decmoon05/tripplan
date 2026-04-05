'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Trash2, ChevronRight } from 'lucide-react';
import type { Trip } from '@/types/database';

interface TripCardProps {
  trip: Trip;
  onDelete: (tripId: string) => void;
  isDeleting: boolean;
}

export function TripCard({ trip, onDelete, isDeleting }: TripCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(trip.id);
    setShowConfirm(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // 상대 날짜 계산
  const getRelativeLabel = () => {
    if (!trip.startDate || !trip.endDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(trip.startDate + 'T00:00:00');
    const end = new Date(trip.endDate + 'T00:00:00');
    const diffToStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const diffToEnd = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (trip.status === 'completed') return { text: '다녀옴 ✓', color: 'bg-blue-500/20 text-blue-300' };
    if (diffToStart > 0) return { text: `D-${diffToStart}`, color: 'bg-white/10 text-white/60' };
    if (diffToEnd >= 0) return { text: '여행 중 🧳', color: 'bg-orange-500/20 text-orange-300' };
    return { text: '여행 종료', color: 'bg-white/10 text-white/30' };
  };
  const relativeLabel = getRelativeLabel();

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-[#151515] border border-white/5 cursor-pointer hover:border-white/20 transition-all block"
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-rose-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />

      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] uppercase tracking-widest font-bold">
              {trip.status === 'completed' ? '다녀옴' : trip.status}
            </div>
            {relativeLabel && (
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${relativeLabel.color}`}>
                {relativeLabel.text}
              </div>
            )}
          </div>

          {/* Delete button */}
          {showConfirm ? (
            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 z-20">
              <span className="text-xs text-rose-400">Delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs font-medium text-rose-400 hover:text-rose-300 disabled:opacity-50"
              >
                {isDeleting ? '...' : 'Yes'}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="text-xs text-white/40 hover:text-white/60"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="p-2 rounded-full bg-black/20 text-white/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
            <MapPin className="w-3 h-3" />
            <span>{trip.destination}</span>
          </div>
          <h3 className="text-2xl font-medium mb-4 group-hover:translate-x-1 transition-transform flex items-center gap-2">
            {trip.destination}
            <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all" />
          </h3>
          <div className="flex items-center gap-4 text-xs text-white/40 font-mono">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              <span>
                {trip.startDate && trip.endDate
                  ? `${formatDate(trip.startDate)} - ${formatDateFull(trip.endDate)}`
                  : 'Dates TBD'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
