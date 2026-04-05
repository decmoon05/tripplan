'use client';

import { TrendingUp } from 'lucide-react';
import type { ExchangeRateResult } from '@/types/database';

interface Props {
  rate: ExchangeRateResult;
  targetCurrency: string;
}

/**
 * 1 USD = 1,345 KRW 형식으로 환율 배지 표시
 * KRW → target 기준으로 표시 (한국 여행자 기준)
 */
export function ExchangeBadge({ rate, targetCurrency }: Props) {
  // 1 KRW = rate TARGET
  // 사용자 친화적 표시: 1 TARGET = inverseRate KRW
  const inverseFormatted = formatCurrency(rate.inverseRate, 'KRW');
  const rateFormatted = formatSmallRate(rate.rate, targetCurrency);

  return (
    <div className="pt-6 border-t border-black/5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-black/80">실시간 환율</h3>
        {rate.isFallback && (
          <span className="ml-auto text-[10px] text-black/25 bg-black/5 px-2 py-0.5 rounded-full">
            참고값
          </span>
        )}
        {!rate.isFallback && (
          <span className="ml-auto text-[10px] text-black/30">실시간</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 bg-orange-500/5 border border-orange-500/10 rounded-xl px-4 py-2.5">
          <span className="text-sm font-bold text-black/80">
            1 {targetCurrency}
          </span>
          <span className="text-black/30">=</span>
          <span className="text-sm font-bold text-orange-600">
            {inverseFormatted}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5">
          <span className="text-xs text-black/40">
            1만원 ≈ {rateFormatted}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'KRW') {
    return `₩${Math.round(amount).toLocaleString()}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

function formatSmallRate(rate: number, currency: string): string {
  // 1만원이 현지 화폐로 얼마인지
  const tenThousandWon = 10000 * rate;
  if (tenThousandWon >= 1000) {
    return `${Math.round(tenThousandWon).toLocaleString()} ${currency}`;
  }
  if (tenThousandWon >= 100) {
    return `${Math.round(tenThousandWon)} ${currency}`;
  }
  return `${tenThousandWon.toFixed(1)} ${currency}`;
}
