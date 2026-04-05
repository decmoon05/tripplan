'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Zap, Clock, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';

interface AILogEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  endpoint: string;
  destination: string;
  durationMs: number;
  success: boolean;
  error: string | null;
  itemCount: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUSD: number | null;
  userPromptPreview: string;
}

interface LogSummary {
  totalEntries: number;
  totalCostUSD: number;
  totalTokens: number;
  successRate: number;
}

export function AILogPanel() {
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/ai-logs?limit=50');
      if (!res.ok) throw new Error('AI 로그 조회 실패');
      const json = await res.json();
      setLogs(json.data.logs);
      setSummary(json.data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleClear = async () => {
    await fetch('/api/v1/admin/ai-logs', { method: 'DELETE' });
    fetchLogs();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) return <div className="text-center py-8 text-white/40">로그 로딩 중...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold mb-1">
              <Zap size={12} /> 총 호출
            </div>
            <p className="text-2xl font-bold">{summary.totalEntries}</p>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold mb-1">
              <DollarSign size={12} /> 추정 비용
            </div>
            <p className="text-2xl font-bold">${summary.totalCostUSD.toFixed(4)}</p>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold mb-1">
              <Clock size={12} /> 총 토큰
            </div>
            <p className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-white/40 text-xs font-bold mb-1">
              <CheckCircle size={12} /> 성공률
            </div>
            <p className="text-2xl font-bold">{summary.successRate}%</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg transition"
        >
          <RefreshCw size={12} /> 새로고침
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition"
        >
          <Trash2 size={12} /> 로그 초기화
        </button>
        <span className="text-xs text-white/30">서버 메모리 기반 (재시작 시 초기화)</span>
      </div>

      {/* Log table */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-white/30">아직 AI 호출 기록이 없습니다</div>
      ) : (
        <div className="bg-white/[0.04] rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">목적지</th>
                  <th className="px-4 py-3">소요시간</th>
                  <th className="px-4 py-3">아이템</th>
                  <th className="px-4 py-3">토큰</th>
                  <th className="px-4 py-3">비용</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/10 hover:bg-white/[0.04]">
                    <td className="px-4 py-3 text-xs text-white/50 font-mono">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      {log.success ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <span title={log.error ?? ''}>
                          <AlertCircle size={14} className="text-red-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-mono">{log.provider}</span>
                      <span className="ml-1 text-[10px] text-white/30">{log.model}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{log.destination}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white/50">{formatDuration(log.durationMs)}</td>
                    <td className="px-4 py-3 text-xs">{log.itemCount ?? '-'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white/50">
                      {log.totalTokens ? log.totalTokens.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {log.estimatedCostUSD ? `$${log.estimatedCostUSD.toFixed(4)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
