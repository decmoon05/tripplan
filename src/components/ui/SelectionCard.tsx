'use client';

interface SelectionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}

export function SelectionCard({ label, description, selected, onClick }: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'bg-white text-black border-white'
          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
      }`}
    >
      <div className="font-medium">{label}</div>
      {description && (
        <div className={`mt-1 text-sm ${selected ? 'text-black/60' : 'text-white/40'}`}>
          {description}
        </div>
      )}
    </button>
  );
}
