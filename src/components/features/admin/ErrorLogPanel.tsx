'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

interface ErrorEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  statusCode: number;
  errorCode: string;
  message: string;
}

interface ErrorStats {
  total: number;
  last24h: number;
  byStatusCode: Record<string, number>;
}

export function ErrorLogPanel() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/v1/admin/errors?limit=100');
    if (res.ok) {
      const json = await res.json();
      setErrors(json.data.errors);
      setStats(json.data.stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const handleClear = async () => {
    await fetch('/api/v1/admin/errors', { method: 'DELETE' });
    fetchErrors();
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('ko-KR');

  const statusColor = (code: number) => {
    if (code >= 500) return 'bg-red-500/10 text-red-600';
    if (code >= 400) return 'bg-orange-500/10 text-orange-600';
    return 'bg-white/10 text-white/50';
  };

  if (loading) return <div className="py-8 text-center text-white/40">에러 로그 로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="flex gap-4">
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 flex-1">
            <p className="text-xs text-white/40 font-bold">총 에러</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 flex-1">
            <p className="text-xs text-white/40 font-bold">24시간</p>
            <p className="text-2xl font-bold">{stats.last24h}</p>
          </div>
          {Object.entries(stats.byStatusCode).map(([code, count]) => (
            <div key={code} className="bg-white/[0.04] rounded-2xl p-4 border border-white/10 flex-1">
              <p className="text-xs text-white/40 font-bold">{code}</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <button type="button" onClick={fetchErrors} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition">
          <RefreshCw size={12} /> 새로고침
        </button>
        <button type="button" onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition">
          <Trash2 size={12} /> 초기화
        </button>
      </div>

      {/* Error list */}
      {errors.length === 0 ? (
        <div className="text-center py-12 text-white/30">에러 없음 🎉</div>
      ) : (
        <div className="bg-white/[0.04] rounded-2xl border border-white/10 divide-y divide-white/10">
          {errors.map((err) => (
            <div key={err.id} className="px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(err.statusCode)}`}>
                    {err.statusCode}
                  </span>
                  <span className="text-xs text-white/40 font-mono">{err.endpoint}</span>
                  <span className="text-[10px] text-white/30 ml-auto">{formatTime(err.timestamp)}</span>
                </div>
                <p className="text-sm text-white/70 truncate">{err.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
