'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp } from 'lucide-react';

interface VoteOption {
  value: string;
  label: string;
}

interface VoteSummary {
  [value: string]: number;
}

interface VoteButtonProps {
  roomId: string;
  topic: string;
  options: VoteOption[];
  currentUserId: string;
}

export function VoteButton({ roomId, topic, options, currentUserId }: VoteButtonProps) {
  const [myVote, setMyVote] = useState<string | null>(null);
  const [summary, setSummary] = useState<VoteSummary>({});
  const [isLoading, setIsLoading] = useState(true);
  const [totalVoters, setTotalVoters] = useState(0);

  useEffect(() => {
    fetch(`/api/v1/rooms/${roomId}/votes?topic=${encodeURIComponent(topic)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const votes = json.data.votes ?? [];
          const userVote = votes.find((v: { user_id: string; value: string }) => v.user_id === currentUserId);
          if (userVote) setMyVote(userVote.value);
          setSummary(json.data.summary?.[topic] ?? {});
          setTotalVoters(new Set(votes.map((v: { user_id: string }) => v.user_id)).size);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [roomId, topic, currentUserId]);

  const handleVote = async (value: string) => {
    const newVote = myVote === value ? null : value;
    setMyVote(newVote);

    if (newVote) {
      try {
        const res = await fetch(`/api/v1/rooms/${roomId}/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, value: newVote }),
        });
        const json = await res.json();
        if (json.success) {
          // Refresh summary
          const refreshRes = await fetch(`/api/v1/rooms/${roomId}/votes?topic=${encodeURIComponent(topic)}`);
          const refreshJson = await refreshRes.json();
          if (refreshJson.success) {
            setSummary(refreshJson.data.summary?.[topic] ?? {});
          }
        }
      } catch {
        setMyVote(myVote); // revert
      }
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <ThumbsUp className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-semibold text-black/60">{topic}</span>
        {totalVoters > 0 && (
          <span className="text-[10px] text-black/30">({totalVoters}명 투표)</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const count = summary[opt.value] || 0;
          const isSelected = myVote === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleVote(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white border border-black/10 text-black/60 hover:border-orange-500/50 hover:text-orange-600'
              }`}
            >
              {opt.label}
              {count > 0 && (
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-black/5'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
