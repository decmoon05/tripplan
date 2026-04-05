interface DailyUsage {
  date: string;
  count: number;
}

interface UsageChartProps {
  dailyUsage: DailyUsage[];
}

export function UsageChart({ dailyUsage }: UsageChartProps) {
  const max = Math.max(...dailyUsage.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="mb-4 text-sm font-semibold text-white/70">일별 AI 사용량 (최근 7일)</h3>
      <div className="space-y-3">
        {dailyUsage.map((day) => {
          const pct = Math.round((day.count / max) * 100);
          const label = day.date.slice(5); // MM-DD
          return (
            <div key={day.date} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-white/50">{label}</span>
              <div className="h-6 flex-1 rounded-md bg-white/10">
                <div
                  className="flex h-full items-center rounded-md bg-[var(--color-primary)] px-2 text-xs font-medium text-white transition-all"
                  style={{ width: `${Math.max(pct, day.count > 0 ? 8 : 0)}%` }}
                >
                  {day.count > 0 && day.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
