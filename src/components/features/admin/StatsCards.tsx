interface StatsCardsProps {
  todayUsage: number;
  weekUsage: number;
  totalUsers: number;
  totalTrips: number;
}

const cards = [
  { key: 'todayUsage', label: '오늘 AI 호출', color: 'bg-blue-50 text-blue-700' },
  { key: 'weekUsage', label: '이번 주 AI 호출', color: 'bg-green-50 text-green-700' },
  { key: 'totalUsers', label: '총 유저 수', color: 'bg-purple-50 text-purple-700' },
  { key: 'totalTrips', label: '총 여행 수', color: 'bg-orange-50 text-orange-700' },
] as const;

export function StatsCards({ todayUsage, weekUsage, totalUsers, totalTrips }: StatsCardsProps) {
  const values: Record<string, number> = { todayUsage, weekUsage, totalUsers, totalTrips };

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className={`rounded-xl p-5 ${card.color}`}>
          <p className="text-sm font-medium opacity-80">{card.label}</p>
          <p className="mt-1 text-3xl font-bold">{values[card.key]}</p>
        </div>
      ))}
    </div>
  );
}
