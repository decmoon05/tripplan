'use client';

import { useTrips } from '@/hooks/useTrips';
import { Globe, Clock, TrendingUp, Map } from 'lucide-react';

function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

// Extract country/region from destination string
function extractCountry(destination: string): string {
  const parts = destination.split(/[,，、]/);
  return parts[parts.length - 1]?.trim() || destination;
}

export function TravelStats() {
  const { data: trips = [], isLoading } = useTrips();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const confirmedTrips = trips.filter(t => t.status === 'confirmed');
  const allTrips = trips;

  // Total travel days
  const totalDays = confirmedTrips.reduce((sum, trip) => {
    return sum + getDayCount(trip.startDate, trip.endDate);
  }, 0);

  // Unique destinations
  const uniqueDestinations = new Set(
    allTrips.map(t => t.destination.toLowerCase()),
  ).size;

  // Unique countries
  const uniqueCountries = new Set(
    allTrips.map(t => extractCountry(t.destination).toLowerCase()),
  ).size;

  // Most visited destination
  const destCount: Record<string, number> = {};
  for (const trip of allTrips) {
    const dest = trip.destination;
    destCount[dest] = (destCount[dest] || 0) + 1;
  }
  const topDestination = Object.entries(destCount).sort((a, b) => b[1] - a[1])[0];

  // Trip count per status
  const statusCounts = {
    total: allTrips.length,
    confirmed: confirmedTrips.length,
    generated: trips.filter(t => t.status === 'generated').length,
    draft: trips.filter(t => t.status === 'draft').length,
  };

  const stats = [
    {
      icon: Globe,
      label: '방문 국가/지역',
      value: uniqueCountries,
      unit: '곳',
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      icon: Map,
      label: '방문 도시',
      value: uniqueDestinations,
      unit: '개',
      color: 'text-purple-600',
      bg: 'bg-purple-500/10',
    },
    {
      icon: Clock,
      label: '총 여행 일수',
      value: totalDays,
      unit: '일',
      color: 'text-orange-600',
      bg: 'bg-orange-500/10',
    },
    {
      icon: TrendingUp,
      label: '확정된 여행',
      value: statusCounts.confirmed,
      unit: '개',
      color: 'text-green-600',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm"
          >
            <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-black">
              {stat.value.toLocaleString()}
              <span className="text-sm font-normal text-black/40 ml-0.5">{stat.unit}</span>
            </p>
            <p className="text-xs text-black/50 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Top destination */}
      {topDestination && (
        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-widest mb-2">가장 많이 간 여행지</p>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-black">{topDestination[0]}</p>
            <span className="text-sm font-medium text-orange-600 bg-orange-500/10 px-3 py-1 rounded-full">
              {topDestination[1]}회
            </span>
          </div>
        </div>
      )}

      {/* Trip distribution */}
      {allTrips.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-widest mb-3">여행 상태 분포</p>
          <div className="space-y-2">
            {[
              { label: '확정', count: statusCounts.confirmed, color: 'bg-green-500' },
              { label: '생성됨', count: statusCounts.generated, color: 'bg-orange-500' },
              { label: '초안', count: statusCounts.draft, color: 'bg-black/20' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-black/50 w-14">{label}</span>
                <div className="flex-1 bg-black/5 rounded-full h-1.5">
                  <div
                    className={`${color} h-1.5 rounded-full transition-all`}
                    style={{ width: statusCounts.total > 0 ? `${(count / statusCounts.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium text-black/60 w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
