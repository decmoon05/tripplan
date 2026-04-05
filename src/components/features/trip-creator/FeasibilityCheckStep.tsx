'use client';

import type { FeasibilityCheckResult, FeasibilityOption } from '@/lib/services/ai/types';

interface FeasibilityCheckStepProps {
  result: FeasibilityCheckResult;
  onSelect: (option: FeasibilityOption) => void;
  onProceedAsIs: () => void;
}

export function FeasibilityCheckStep({ result, onSelect, onProceedAsIs }: FeasibilityCheckStepProps) {
  if (result.status !== 'has_concerns') return null;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h2 className="text-xl font-bold text-black">확인이 필요해요</h2>

      {/* 경고 카드 */}
      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm text-orange-900 leading-relaxed">{result.message}</p>
        </div>
      </div>

      {/* 선택지 */}
      <div className="mt-6 space-y-3">
        {result.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (option.action === 'proceed_limited') {
                onProceedAsIs();
              } else {
                onSelect(option);
              }
            }}
            className={`w-full rounded-2xl border p-5 text-left transition-all ${
              option.action === 'proceed_limited'
                ? 'border-black/10 bg-white hover:border-orange-300 hover:shadow-sm'
                : 'border-black/10 bg-white hover:border-orange-400 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                {option.id}
              </span>
              <div>
                <span className="text-sm font-medium text-black">{option.label}</span>
                {option.suggestedDestination && (
                  <p className="mt-1 text-xs text-black/40">
                    목적지 → {option.suggestedDestination}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
