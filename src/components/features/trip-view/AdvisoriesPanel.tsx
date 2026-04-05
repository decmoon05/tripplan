'use client';

import { useState } from 'react';
import {
  Cloud, Shield, ArrowLeftRight, CalendarDays,
  Globe, AlertTriangle, Info, ChevronDown,
} from 'lucide-react';
import type { TripAdvisories } from '@/types/database';

interface AdvisoriesPanelProps {
  advisories: TripAdvisories;
}

const ADVISORY_CONFIG: {
  key: keyof TripAdvisories;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: 'weather', label: 'Weather', icon: <Cloud size={14} /> },
  { key: 'safety', label: 'Safety', icon: <Shield size={14} /> },
  { key: 'exchangeRate', label: 'Exchange Rate', icon: <ArrowLeftRight size={14} /> },
  { key: 'holidays', label: 'Local Holidays', icon: <CalendarDays size={14} /> },
  { key: 'atmosphere', label: 'Atmosphere', icon: <Globe size={14} /> },
  { key: 'disasters', label: 'Disaster Risks', icon: <AlertTriangle size={14} /> },
  { key: 'other', label: 'Other Advisories', icon: <Info size={14} /> },
];

export function AdvisoriesPanel({ advisories }: AdvisoriesPanelProps) {
  const activeItems = ADVISORY_CONFIG.filter(
    (cfg) => advisories[cfg.key] && advisories[cfg.key].trim().length > 0,
  );

  if (activeItems.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {activeItems.map((cfg) => (
        <div
          key={cfg.key}
          className="bg-[#f8f9fa] p-4 rounded-xl border border-black/5"
        >
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-1">
            {cfg.label}
          </p>
          <p className="text-sm text-black/70">
            {advisories[cfg.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
