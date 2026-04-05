'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

interface CacheStatus {
  weather: { entries: number; ttlMs: number };
  exchange: { entries: number; ttlMs: number };
  places: { entries: number; maxEntries: number; ttlMs: number };
}

export function CachePanel() {
  const [cache, setCache] = useState<CacheStatus | null>(null);
  const [msg, setMsg] = useState('');

  const fetchCache = useCallback(async () => {
    const res = await fetch('/api/v1/admin/cache');
    if (res.ok) { const json = await res.json(); setCache(json.data); }
  }, []);

  useEffect(() => { fetchCache(); }, [fetchCache]);

  const flush = async (type: string) => {
    await fetch(`/api/v1/admin/cache?type=${type}`, { method: 'DELETE' });
    fetchCache();
    setMsg(`${type} 캐시 플러시 완료`);
    setTimeout(() => setMsg(''), 2000);
  };

  if (!cache) return <div className="py-8 text-center text-white/40">캐시 로딩 중...</div>;

  const items = [
    { key: 'weather', label: '🌤️ 날씨', data: cache.weather },
    { key: 'exchange', label: '💱 환율', data: cache.exchange },
    { key: 'places', label: '📍 장소', data: cache.places },
  ];

  return (
    <div className="space-y-4">
      {items.map(({ key, label, data }) => (
        <div key={key} className="bg-white/[0.04] rounded-2xl p-5 border border-white/10 flex items-center justify-between">
          <div>
            <p className="font-semibold">{label}</p>
            <p className="text-xs text-white/40">
              {data.entries}개 캐시됨 · TTL {Math.round(data.ttlMs / 60000)}분
              {'maxEntries' in data && ` · 최대 ${(data as { maxEntries: number }).maxEntries}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => flush(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition"
          >
            <Trash2 size={12} /> 플러시
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => flush('all')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition"
        >
          <Trash2 size={12} /> 전체 플러시
        </button>
        <button
          type="button"
          onClick={fetchCache}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition"
        >
          <RefreshCw size={12} /> 새로고침
        </button>
        {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
      </div>
    </div>
  );
}
