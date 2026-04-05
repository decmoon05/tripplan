'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface AIProviderHealth {
  reachable: boolean;
  latencyMs: number;
  keyConfigured: boolean;
  model: string;
  error: string | null;
}

interface HealthData {
  database: { connected: boolean; latencyMs: number; error: string | null };
  externalAPIs: Record<string, { reachable: boolean; latencyMs: number; keyConfigured?: boolean }>;
  aiProviders?: Record<string, AIProviderHealth>;
  caches: Record<string, { entries: number; ttlMs?: number; maxEntries?: number }>;
  config: { aiEnabled: boolean; aiProvider: string; dailyLimit: number; features: Record<string, boolean> };
}

export function HealthPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/health');
      if (res.ok) {
        const json = await res.json();
        setHealth(json.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  if (loading) return <div className="py-8 text-center text-white/40">헬스체크 중...</div>;
  if (!health) return <div className="py-8 text-center text-red-500">헬스체크 실패</div>;

  const StatusIcon = ({ ok }: { ok: boolean }) => ok
    ? <CheckCircle size={16} className="text-green-500" />
    : <XCircle size={16} className="text-red-500" />;

  return (
    <div className="space-y-6">
      {/* DB */}
      <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
        <h3 className="font-bold mb-3">📦 Database (Supabase)</h3>
        <div className="flex items-center gap-3">
          <StatusIcon ok={health.database.connected} />
          <span className="font-medium">{health.database.connected ? '연결됨' : '연결 실패'}</span>
          <span className="text-xs text-white/40 font-mono flex items-center gap-1">
            <Clock size={10} /> {health.database.latencyMs}ms
          </span>
          {health.database.error && <span className="text-xs text-red-500">{health.database.error}</span>}
        </div>
      </div>

      {/* External APIs */}
      <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
        <h3 className="font-bold mb-3">🌐 외부 API</h3>
        <div className="space-y-2">
          {Object.entries(health.externalAPIs).map(([name, status]) => (
            <div key={name} className="flex items-center gap-3">
              <StatusIcon ok={status.reachable} />
              <span className="font-medium w-32">{name}</span>
              <span className="text-xs text-white/40 font-mono">{status.latencyMs}ms</span>
              {'keyConfigured' in status && !status.keyConfigured && (
                <span className="text-xs text-orange-500">키 미설정</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Providers */}
      {health.aiProviders && (
        <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
          <h3 className="font-bold mb-3">🤖 AI 모델 통신 상태</h3>
          <div className="space-y-3">
            {Object.entries(health.aiProviders).map(([name, status]) => {
              const isActive = health.config.aiProvider === name;
              return (
                <div key={name} className="flex items-center gap-3">
                  <StatusIcon ok={status.reachable} />
                  <div className="flex items-center gap-2 w-28">
                    <span className="font-medium capitalize">{name}</span>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400">활성</span>
                    )}
                  </div>
                  <span className="text-xs text-white/50 font-mono w-20">{status.model}</span>
                  {status.keyConfigured ? (
                    <>
                      <span className="text-xs text-white/40 font-mono">{status.latencyMs}ms</span>
                      {status.error && <span className="text-xs text-red-400">{status.error}</span>}
                    </>
                  ) : (
                    <span className="text-xs text-orange-400">키 미설정</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-white/20 mt-3">
            * Gemini: models.list(무료) / Claude: ping 1토큰(극소비용) / OpenAI: models(무료)로 체크
          </p>
        </div>
      )}

      {/* Caches */}
      <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
        <h3 className="font-bold mb-3">💾 캐시 상태</h3>
        <div className="space-y-2">
          {Object.entries(health.caches).map(([name, cache]) => (
            <div key={name} className="flex items-center gap-3">
              <span className="font-medium w-24">{name}</span>
              <span className="text-sm font-mono">{cache.entries}개</span>
              {cache.maxEntries && <span className="text-xs text-white/30">/ {cache.maxEntries}</span>}
              {cache.ttlMs && <span className="text-xs text-white/30">TTL {Math.round(cache.ttlMs / 60000)}분</span>}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={fetchHealth}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition"
      >
        <RefreshCw size={12} /> 다시 체크
      </button>
    </div>
  );
}
