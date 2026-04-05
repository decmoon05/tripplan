'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';

interface Config {
  aiProvider: string;
  aiEnabled: boolean;
  dailyLimitPerUser: number;
  monthlySpendCapUSD: number;
  features: Record<string, boolean>;
}

const FEATURE_LABELS: Record<string, string> = {
  weather: '날씨 API (Open-Meteo, 무료)',
  exchange: '환율 API (open.er-api, 무료)',
  googlePlaces: 'Google Places (유료!)',
  popularPlaces: '인기 장소 사전 수집 (Google Places)',
  feasibilityCheck: '타당성 검사 (AI 호출)',
  postValidation: '사후 검증 (Google Places 호출)',
};

export function ConfigPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/v1/admin/config');
    if (res.ok) {
      const json = await res.json();
      setConfig(json.data);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const res = await fetch('/api/v1/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (res.ok) {
      setMsg('저장됨 ✓');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  const reset = async () => {
    await fetch('/api/v1/admin/config', { method: 'DELETE' });
    fetchConfig();
    setMsg('초기화됨');
    setTimeout(() => setMsg(''), 2000);
  };

  if (!config) return <div className="py-8 text-center text-white/40">설정 로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* AI 메인 스위치 */}
      <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
        <h3 className="font-bold text-lg mb-4">🤖 AI 제어</h3>

        <div className="space-y-4">
          {/* AI on/off */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">AI 전체</p>
              <p className="text-xs text-white/40">OFF 시 모든 AI 호출 차단 (비용 0)</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, aiEnabled: !config.aiEnabled })}
              className={`w-14 h-7 rounded-full transition-colors relative ${config.aiEnabled ? 'bg-green-500' : 'bg-black/20'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${config.aiEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          {/* Provider 선택 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">AI Provider</p>
              <p className="text-xs text-white/40">일정 생성에 사용할 AI</p>
            </div>
            <select
              value={config.aiProvider}
              onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
              className="bg-white/10 rounded-lg px-3 py-1.5 text-sm font-mono"
            >
              <option value="gemini">Gemini (무료 티어)</option>
              <option value="claude">Claude (유료)</option>
              <option value="openai">OpenAI (유료)</option>
              <option value="mock">Mock (비용 0, 테스트용)</option>
            </select>
          </div>

          {/* 일일 한도 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">유저당 일일 AI 한도</p>
              <p className="text-xs text-white/40">0 = 무제한</p>
            </div>
            <input
              type="number"
              value={config.dailyLimitPerUser}
              onChange={(e) => setConfig({ ...config, dailyLimitPerUser: Number(e.target.value) })}
              className="w-20 bg-white/10 rounded-lg px-3 py-1.5 text-sm text-right font-mono"
              min={0}
              max={1000}
            />
          </div>

          {/* 월간 비용 상한 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">월간 비용 상한 (USD)</p>
              <p className="text-xs text-white/40">초과 시 AI 자동 차단</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-white/40">$</span>
              <input
                type="number"
                value={config.monthlySpendCapUSD}
                onChange={(e) => setConfig({ ...config, monthlySpendCapUSD: Number(e.target.value) })}
                className="w-24 bg-white/10 rounded-lg px-3 py-1.5 text-sm text-right font-mono"
                min={0}
                max={10000}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 기능 토글 */}
      <div className="bg-white/[0.04] rounded-2xl p-6 border border-white/10">
        <h3 className="font-bold text-lg mb-4">🔧 기능 on/off</h3>
        <div className="space-y-3">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm">{label}</p>
              <button
                type="button"
                onClick={() => setConfig({
                  ...config,
                  features: { ...config.features, [key]: !config.features[key] },
                })}
                className={`w-12 h-6 rounded-full transition-colors relative ${config.features[key] ? 'bg-green-500' : 'bg-black/20'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config.features[key] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 저장/초기화 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '저장 중...' : '설정 저장'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-sm font-semibold rounded-lg hover:bg-white/20 transition"
        >
          <RotateCcw size={14} /> 기본값 초기화
        </button>
        {msg && <span className="text-sm text-green-600 font-medium">{msg}</span>}
      </div>
    </div>
  );
}
