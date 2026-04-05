'use client';

import {
  Footprints, Bus, Car, TrainFront, Bike, Plane, Ship,
  Navigation,
} from 'lucide-react';

const TRANSIT_ICONS: Record<string, React.ReactNode> = {
  walk: <Footprints size={12} />,
  bus: <Bus size={12} />,
  taxi: <Car size={12} />,
  subway: <TrainFront size={12} />,
  train: <TrainFront size={12} />,
  bicycle: <Bike size={12} />,
  drive: <Car size={12} />,
  flight: <Plane size={12} />,
  ferry: <Ship size={12} />,
};

interface TransitBadgeProps {
  transitMode: string | null;
  transitDurationMin: number | null;
  transitSummary: string | null;
}

export function TransitBadge({ transitMode, transitDurationMin, transitSummary }: TransitBadgeProps) {
  if (!transitMode) return null;

  const icon = TRANSIT_ICONS[transitMode] || <Navigation className="w-3 h-3" />;

  return (
    <div className="pt-6 border-t border-black/5 flex flex-wrap items-center gap-2 md:gap-4 text-xs text-black/40 font-medium mb-6">
      <div className="flex items-center gap-2 shrink-0">
        <Navigation className="w-3 h-3" />
        <span className="capitalize">{transitMode}</span>
      </div>
      {transitDurationMin != null && (
        <>
          <span className="shrink-0">&bull;</span>
          <span className="shrink-0">{transitDurationMin} min</span>
        </>
      )}
      {transitSummary && (
        <>
          <span className="shrink-0">&bull;</span>
          <span className="italic font-normal">{transitSummary}</span>
        </>
      )}
    </div>
  );
}
