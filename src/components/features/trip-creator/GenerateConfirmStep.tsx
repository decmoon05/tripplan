'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, DollarSign, FileText, Cpu, MapPin, Loader2 } from 'lucide-react';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { PlacePreference } from '@/types/database';

interface PlaceSelection {
  placeName: string;
  preference: PlacePreference;
}

interface GenerateConfirmStepProps {
  destination: string;
  startDate: string;
  endDate: string;
  profile: FullProfileInput;
  placeSelections?: PlaceSelection[];
  specialRequest: string;
  showDebug?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

interface EstimateData {
  model: string;
  provider: string;
  countMethod: 'exact' | 'estimated';
  systemPromptLength: number;
  userPromptLength: number;
  systemPromptPreview: string;
  userPromptPreview: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  totalTokens: number;
  pricing: { input: number; output: number };
  estimatedCostUSD: number;
  dayCount: number;
  itemsPerDay: number;
}

function getDayCount(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export function GenerateConfirmStep({
  destination, startDate, endDate, profile, placeSelections, specialRequest, showDebug = false, onConfirm, onBack,
}: GenerateConfirmStepProps) {
  const dayCount = getDayCount(startDate, endDate);
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  // admin/developer일 때만 서버에서 정확한 토큰 추정 가져오기
  useEffect(() => {
    if (!showDebug) return;

    async function fetchEstimate() {
      setEstimateLoading(true);
      try {
        const res = await fetch('/api/v1/ai/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: 'estimate', // dummy — estimate API에서는 trip 조회 안 함
            profile,
            tripInput: { destination, startDate, endDate },
            placePreferences: placeSelections,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setEstimate(json.data);
        }
      } catch {
        // 추정 실패는 무시
      }
      setEstimateLoading(false);
    }
    fetchEstimate();
  }, [showDebug, destination, startDate, endDate, profile, placeSelections]);

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <h2 className="text-xl font-bold text-white">일정 생성 확인</h2>
      <p className="text-sm text-white/50">아래 정보로 AI가 여행 일정을 생성합니다.</p>

      {/* 여행 요약 */}
      <div className="bg-white/[0.04] rounded-2xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
          <MapPin size={12} /> 여행 정보
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/40 text-xs">목적지</p>
            <p className="font-medium">{destination}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">기간</p>
            <p className="font-medium">{dayCount}일 ({startDate} ~ {endDate})</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">동행</p>
            <p className="font-medium">{profile.companion}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">예산</p>
            <p className="font-medium">{profile.budgetRange}</p>
          </div>
        </div>
        {specialRequest && (
          <div>
            <p className="text-white/40 text-xs">특별 요청</p>
            <p className="text-sm text-white/70 mt-0.5">{specialRequest}</p>
          </div>
        )}
        {placeSelections && placeSelections.length > 0 && (
          <div>
            <p className="text-white/40 text-xs">장소 선호도</p>
            <p className="text-sm text-white/70 mt-0.5">
              {placeSelections.filter(s => s.preference === 'exclude').length > 0 && `제외 ${placeSelections.filter(s => s.preference === 'exclude').length}곳 `}
              {placeSelections.filter(s => s.preference === 'revisit').length > 0 && `재방문 ${placeSelections.filter(s => s.preference === 'revisit').length}곳`}
            </p>
          </div>
        )}
      </div>

      {/* AI 모델 & 비용 + 프롬프트 (admin/developer만) */}
      {showDebug && (
        <>
          <div className="bg-white/[0.04] rounded-2xl p-5 border border-orange-500/20 space-y-3">
            <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Cpu size={12} /> AI 모델 & 예상 비용
              <span className="ml-auto px-2 py-0.5 rounded bg-orange-500/20 text-[9px]">DEV ONLY</span>
            </div>

            {estimateLoading ? (
              <div className="flex items-center gap-2 text-white/40 text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> Gemini countTokens 호출 중...
              </div>
            ) : estimate ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Provider</span>
                  <span className="font-mono">{estimate.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">모델</span>
                  <span className="font-mono text-orange-300">{estimate.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">토큰 측정 방식</span>
                  <span className={`font-mono ${estimate.countMethod === 'exact' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {estimate.countMethod === 'exact' ? '✓ Gemini countTokens (정확)' : '~ 문자 수 추정'}
                  </span>
                </div>
                <div className="border-t border-white/[0.06] my-2" />
                <div className="flex justify-between">
                  <span className="text-white/50">시스템 프롬프트</span>
                  <span className="font-mono">{estimate.systemPromptLength.toLocaleString()}자</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">유저 프롬프트</span>
                  <span className="font-mono">{estimate.userPromptLength.toLocaleString()}자</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">입력 토큰</span>
                  <span className="font-mono font-bold">{estimate.inputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">예상 출력 토큰</span>
                  <span className="font-mono">{estimate.estimatedOutputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">총 예상</span>
                  <span className="font-mono font-bold">{estimate.totalTokens.toLocaleString()} tokens</span>
                </div>
                <div className="border-t border-white/[0.06] my-2" />
                <div className="flex justify-between text-[10px] text-white/30">
                  <span>가격: 입력 ${estimate.pricing.input}/1M · 출력 ${estimate.pricing.output}/1M</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50 flex items-center gap-1"><DollarSign size={12} /> 예상 비용</span>
                  <span className="font-mono font-bold text-lg text-green-400">${estimate.estimatedCostUSD.toFixed(4)}</span>
                </div>
                <p className="text-[10px] text-white/30">
                  * 입력 토큰은 {estimate.countMethod === 'exact' ? 'Gemini countTokens API로 정확히 측정' : '문자 수 기반 추정'}. 출력 토큰은 {estimate.dayCount}일 × {estimate.itemsPerDay}아이템 × 150토큰 기반 추정.
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/30">토큰 추정 실패</p>
            )}
          </div>

          {/* 프롬프트 미리보기 */}
          {estimate && (
            <div className="bg-white/[0.04] rounded-2xl p-5 border border-orange-500/20 space-y-3">
              <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
                <FileText size={12} /> 실제 프롬프트 미리보기
                <span className="ml-auto px-2 py-0.5 rounded bg-orange-500/20 text-[9px]">DEV ONLY</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-white/40 font-bold mb-1">SYSTEM ({estimate.systemPromptLength}자)</p>
                  <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-3 max-h-32 overflow-y-auto">
                    {estimate.systemPromptPreview}
                  </pre>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-bold mb-1">USER ({estimate.userPromptLength}자)</p>
                  <pre className="text-[11px] text-white/50 font-mono whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-3 max-h-40 overflow-y-auto">
                    {estimate.userPromptPreview}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border border-white/10 text-white/50 text-sm font-medium hover:bg-white/5 transition"
        >
          <ArrowLeft size={14} /> 장소 선택으로
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition"
        >
          <Zap size={14} /> 일정 생성하기
        </button>
      </div>
    </div>
  );
}
