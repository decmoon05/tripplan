'use client';

import { Calendar } from 'lucide-react';

interface CalendarExportButtonProps {
  tripId: string;
}

export function CalendarExportButton({ tripId }: CalendarExportButtonProps) {
  const handleExport = () => {
    window.location.href = `/api/v1/trips/${tripId}/export?format=ics`;
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black/60 hover:text-black hover:bg-black/5 rounded-full transition-colors"
      title="캘린더에 추가 (ICS)"
    >
      <Calendar className="w-4 h-4" />
      <span className="hidden sm:inline">캘린더 추가</span>
    </button>
  );
}
