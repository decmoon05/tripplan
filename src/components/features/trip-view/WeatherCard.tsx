'use client';

import { Cloud } from 'lucide-react';
import { iconToEmoji } from '@/lib/services/weather.service';
import type { WeatherForecast } from '@/types/database';

interface Props {
  forecast: WeatherForecast;
  startDate: string; // 'YYYY-MM-DD'
  dayCount: number;
}

export function WeatherCard({ forecast, startDate, dayCount }: Props) {
  // 여행 기간 날짜만 필터
  const tripDays = forecast.days.filter((d) => d.date >= startDate).slice(0, dayCount);

  if (tripDays.length === 0) return null;

  return (
    <div className="pt-6 border-t border-black/5">
      <div className="flex items-center gap-2 mb-4">
        <Cloud className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-black/80">여행 기간 날씨</h3>
        <span className="ml-auto text-[10px] text-black/30">Open-Meteo 예보</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {tripDays.map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1 bg-orange-500/5 rounded-xl p-3 border border-orange-500/10"
          >
            <p className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">
              {formatDayLabel(day.date)}
            </p>
            <span className="text-2xl" title={day.description}>
              {iconToEmoji(day.icon)}
            </span>
            <div className="flex items-center gap-1 text-xs font-medium">
              <span className="text-orange-600">{day.tempMax}°</span>
              <span className="text-black/30">/</span>
              <span className="text-black/50">{day.tempMin}°</span>
            </div>
            {day.precipPct > 20 && (
              <p className="text-[10px] text-blue-500 font-medium">💧 {day.precipPct}%</p>
            )}
            <p className="text-[10px] text-black/30 text-center leading-tight capitalize line-clamp-2">
              {day.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = days[date.getDay()];
  return `${month}/${day} ${dow}`;
}
