'use client';

import { useState, useCallback } from 'react';

// ─── 시나리오 데이터 (JSON 파일과 동일) ─────────────────

const SCENARIOS = [
  { id: 'tokyo-solo-3d', name: '도쿄 솔로 3일', tags: ['baseline', 'solo'], dest: '도쿄', days: 3 },
  { id: 'kyushu-rental-family-4d', name: '규슈 렌터카 가족 4일', tags: ['렌터카', 'family'], dest: '후쿠오카', days: 4 },
  { id: 'seoul-tajmahal', name: '서울+타지마할 (모순)', tags: ['지리모순'], dest: '서울', days: 2 },
  { id: 'saga-jjk', name: '사가+주술회전 (불일치)', tags: ['콘텐츠불일치'], dest: '사가', days: 3 },
  { id: 'hokkaido-winter-ski', name: '홋카이도 스키 4일', tags: ['계절', 'couple'], dest: '삿포로', days: 4 },
  { id: 'paris-couple-luxury-5d', name: '파리 럭셔리 5일', tags: ['luxury', 'couple'], dest: '파리', days: 5 },
  { id: 'jeju-budget-backpacker-2d', name: '제주 백패커 2일', tags: ['backpacking', 'solo'], dest: '제주', days: 2 },
  { id: 'osaka-halal-food', name: '오사카 할랄 3일', tags: ['할랄', 'friends'], dest: '오사카', days: 3 },
  { id: 'bangkok-family-kids', name: '방콕 유아동반 3일', tags: ['family-kids'], dest: '방콕', days: 3 },
  { id: 'busan-relaxed-low-stamina', name: '부산 저체력 3일', tags: ['relaxed', 'low-stamina'], dest: '부산', days: 3 },
  { id: 'osaka-foodie-active', name: '오사카 먹방 4일', tags: ['active', 'foodie'], dest: '오사카', days: 4 },
  { id: 'seoul-business-2d', name: '서울 출장 2일', tags: ['business'], dest: '서울', days: 2 },
];

interface ValidationCheck {
  id: string;
  name: string;
  category: string;
  pass: boolean;
  details: string;
}

interface TestResult {
  scenarioId: string;
  status: 'idle' | 'running' | 'pass' | 'fail' | 'error';
  validation: ValidationCheck[];
  summary?: { totalChecks: number; passed: number; failed: number; passRate: string };
  meta?: { provider: string; model: string; durationMs: number; itemCount: number; estimatedCostUSD: number };
  error?: string;
}

export function TestPanel() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runScenario = useCallback(async (scenarioId: string) => {
    setResults(prev => ({ ...prev, [scenarioId]: { scenarioId, status: 'running', validation: [] } }));

    try {
      // 시나리오 JSON 로드 (서버에서)
      const scenarioRes = await fetch(`/api/v1/admin/test-scenarios?id=${scenarioId}`);
      if (!scenarioRes.ok) throw new Error(`시나리오 로드 실패: ${scenarioRes.status}`);
      const scenario = await scenarioRes.json();

      // 테스트 실행
      const res = await fetch('/api/v1/admin/test-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario.data || scenario),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      const data = json.data;

      setResults(prev => ({
        ...prev,
        [scenarioId]: {
          scenarioId,
          status: data.summary.failed === 0 ? 'pass' : 'fail',
          validation: data.validation,
          summary: data.summary,
          meta: data.meta,
        },
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [scenarioId]: {
          scenarioId,
          status: 'error',
          validation: [],
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    await Promise.allSettled(SCENARIOS.map(s => runScenario(s.id)));
    setRunningAll(false);
  }, [runScenario]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return '⏳';
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'error': return '⚠️';
      default: return '⏸';
    }
  };

  const totalResults = Object.values(results);
  const passCount = totalResults.filter(r => r.status === 'pass').length;
  const failCount = totalResults.filter(r => r.status === 'fail' || r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">AI 생성 품질 테스트</h2>
          <p className="text-sm text-white/40 mt-1">
            {SCENARIOS.length}개 시나리오 | 통과 {passCount} | 실패 {failCount}
          </p>
        </div>
        <button
          type="button"
          onClick={runAll}
          disabled={runningAll}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {runningAll ? '실행 중...' : '전체 실행'}
        </button>
      </div>

      {/* 시나리오 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCENARIOS.map(scenario => {
          const result = results[scenario.id];
          const status = result?.status || 'idle';
          const isExpanded = expandedId === scenario.id;

          return (
            <div
              key={scenario.id}
              className={`rounded-xl border p-4 transition-colors ${
                status === 'pass' ? 'border-green-500/30 bg-green-500/5' :
                status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                status === 'error' ? 'border-yellow-500/30 bg-yellow-500/5' :
                status === 'running' ? 'border-orange-500/30 bg-orange-500/5' :
                'border-white/10 bg-white/[0.02]'
              }`}
            >
              {/* 카드 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{statusIcon(status)}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{scenario.name}</h3>
                    <p className="text-xs text-white/40">{scenario.dest} · {scenario.days}일</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result?.meta && (
                    <span className="text-xs text-white/30">{(result.meta.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  <button
                    type="button"
                    onClick={() => runScenario(scenario.id)}
                    disabled={status === 'running'}
                    className="px-2.5 py-1 text-xs bg-white/10 rounded-md hover:bg-white/20 disabled:opacity-30 transition-colors"
                  >
                    실행
                  </button>
                </div>
              </div>

              {/* 태그 */}
              <div className="flex gap-1 mt-2 flex-wrap">
                {scenario.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-white/10 rounded text-white/50">{tag}</span>
                ))}
              </div>

              {/* 결과 요약 (완료 시) */}
              {result && status !== 'idle' && status !== 'running' && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {result.error ? (
                    <p className="text-xs text-red-400">{result.error}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          {result.summary?.passed}/{result.summary?.totalChecks} 통과 ({result.summary?.passRate})
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                          className="text-xs text-orange-400 hover:text-orange-300"
                        >
                          {isExpanded ? '접기' : '상세'}
                        </button>
                      </div>

                      {/* 실패 항목 미리보기 */}
                      {!isExpanded && result.validation.filter(v => !v.pass).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {result.validation.filter(v => !v.pass).slice(0, 2).map(v => (
                            <p key={v.id} className="text-[11px] text-red-400/80 truncate">
                              ✗ {v.name}: {v.details}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* 전체 상세 (펼침) */}
                      {isExpanded && (
                        <div className="mt-3 space-y-1.5">
                          {result.meta && (
                            <div className="text-[11px] text-white/30 mb-2">
                              {result.meta.provider}/{result.meta.model} · {result.meta.itemCount}개 아이템 · ~${result.meta.estimatedCostUSD.toFixed(3)}
                            </div>
                          )}
                          {result.validation.map(v => (
                            <div key={v.id} className={`flex items-start gap-1.5 text-[11px] ${v.pass ? 'text-green-400/70' : 'text-red-400'}`}>
                              <span className="flex-shrink-0 mt-0.5">{v.pass ? '✓' : '✗'}</span>
                              <div className="min-w-0">
                                <span className="font-medium">{v.name}</span>
                                <span className="text-white/30 ml-1">{v.details}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
