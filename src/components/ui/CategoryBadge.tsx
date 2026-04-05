const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  attraction: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: '관광' },
  restaurant: { bg: 'bg-orange-500/20', text: 'text-orange-300', label: '식사' },
  cafe: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: '카페' },
  transport: { bg: 'bg-gray-500/20', text: 'text-gray-300', label: '이동' },
  shopping: { bg: 'bg-pink-500/20', text: 'text-pink-300', label: '쇼핑' },
  hotel: { bg: 'bg-green-500/20', text: 'text-green-300', label: '숙소' },
};

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const style = CATEGORY_STYLES[category] || {
    bg: 'bg-white/10',
    text: 'text-white/60',
    label: category,
  };

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[9px] uppercase tracking-widest font-black ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
