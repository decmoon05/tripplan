'use client';

import { useState, useEffect, useRef } from 'react';
import type { GroundingSource } from '@/hooks/useStreamGenerate';

interface LoadingStepsProps {
  title: string;
  steps: string[];
  intervalMs?: number;
}

export function LoadingSteps({ title, steps, intervalMs = 4000 }: LoadingStepsProps) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= steps.length) return;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), intervalMs);
    return () => clearTimeout(timer);
  }, [visibleCount, steps.length, intervalMs]);

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-6 text-xl font-bold text-[var(--color-foreground)]">{title}</p>

        <div className="mt-6 w-full max-w-sm space-y-2">
          {steps.slice(0, visibleCount).map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{ opacity: i === visibleCount - 1 ? 1 : 0.5 }}
            >
              {i === visibleCount - 1 ? (
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-green-400" />
              )}
              <span className="text-sm text-[var(--color-foreground)]">{step}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-300">AI 모델 응답에 따라 최대 2분 소요</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreamingLoadingSteps — 실시간 AI 진행률 표시
// ---------------------------------------------------------------------------
interface StreamingLoadingStepsProps {
  title: string;
  progress: string[];
  groundingSources: GroundingSource[];
  partialItems: { placeNameSnapshot: string; dayNumber: number }[];
  status: 'streaming' | 'validating' | 'complete' | 'error';
}

export function StreamingLoadingSteps({
  title,
  progress,
  groundingSources,
  partialItems,
  status,
}: StreamingLoadingStepsProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.length, partialItems.length]);

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="flex flex-col items-center justify-center py-8">
        {status !== 'complete' && status !== 'error' && (
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--color-primary)] border-t-transparent" />
        )}
        <p className="mt-6 text-xl font-bold text-[var(--color-foreground)]">{title}</p>

        {/* 실시간 진행 메시지 */}
        <div className="mt-6 w-full max-w-sm space-y-1.5 max-h-48 overflow-y-auto">
          {progress.map((msg, i) => (
            <div
              key={`p-${i}`}
              className="flex items-center gap-3 rounded-lg px-4 py-2"
              style={{ opacity: i === progress.length - 1 ? 1 : 0.4 }}
            >
              {i === progress.length - 1 ? (
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-green-400" />
              )}
              <span className="text-sm text-[var(--color-foreground)]">{msg}</span>
            </div>
          ))}
        </div>

        {/* 부분 아이템 미리보기 */}
        {partialItems.length > 0 && (
          <div className="mt-4 w-full max-w-sm">
            <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">발견된 장소</p>
            <div className="flex flex-wrap gap-1.5">
              {partialItems.map((item, i) => (
                <span
                  key={`item-${i}`}
                  className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]"
                >
                  Day {item.dayNumber} · {item.placeNameSnapshot.split(' (')[0]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Grounding 소스 */}
        {groundingSources.length > 0 && (
          <div className="mt-4 w-full max-w-sm">
            <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">참조한 정보</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {groundingSources.slice(-5).map((src, i) => (
                <p key={`g-${i}`} className="truncate text-xs text-blue-500">
                  🔗 {src.title || src.url}
                </p>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />

        {status === 'validating' && (
          <p className="mt-6 text-xs text-[var(--color-muted)]">일정 검증 및 최적화 중...</p>
        )}
        {status !== 'complete' && status !== 'error' && (
          <p className="mt-4 text-xs text-gray-300">실시간 AI 생성 — Grounding 기반</p>
        )}
      </div>
    </div>
  );
}
