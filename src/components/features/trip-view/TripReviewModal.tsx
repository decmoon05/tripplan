'use client';

import { useState, useCallback } from 'react';
import { X, Star, ChevronRight, SkipForward } from 'lucide-react';
import type { TripItem } from '@/types/database';

interface TripReviewModalProps {
  tripId: string;
  items: TripItem[];
  existingRatings: Record<string, { rating: number; memo: string | null }>;
  onClose: () => void;
  onComplete: () => void;
}

export function TripReviewModal({
  tripId, items, existingRatings, onClose, onComplete,
}: TripReviewModalProps) {
  // 미평가 장소만 필터 (transport, hotel 제외)
  const reviewableItems = items.filter(
    (it) => !existingRatings[it.id] && it.category !== 'transport' && it.category !== 'hotel',
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentItem = reviewableItems[currentIndex];
  const isLast = currentIndex >= reviewableItems.length - 1;
  const progress = reviewableItems.length > 0
    ? Math.round(((currentIndex) / reviewableItems.length) * 100)
    : 100;

  const saveAndNext = useCallback(async () => {
    if (!currentItem || selectedRating === 0) return;
    setIsSaving(true);
    try {
      await fetch(`/api/v1/trips/${tripId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentItem.id,
          rating: selectedRating,
          memo: memo.trim() || null,
        }),
      });
    } catch {
      // 저장 실패해도 다음으로 이동
    }
    setIsSaving(false);

    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedRating(0);
      setMemo('');
      setHoveredStar(0);
    }
  }, [currentItem, selectedRating, memo, isLast, tripId, onComplete]);

  const skip = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedRating(0);
      setMemo('');
      setHoveredStar(0);
    }
  };

  if (reviewableItems.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <p className="text-xl font-medium mb-2">모든 장소를 평가하셨습니다! 🎉</p>
          <p className="text-black/50 text-sm mb-6">평가가 다음 여행 계획에 반영됩니다.</p>
          <button
            type="button"
            onClick={onComplete}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-full font-bold hover:bg-orange-600 transition"
          >
            완료
          </button>
        </div>
      </div>
    );
  }

  // 장소명에서 한국어 이름 추출
  const koreanName = currentItem.placeNameSnapshot.replace(/\s*\(.*?\)\s*$/, '');
  const localName = currentItem.placeNameSnapshot.match(/\(([^)]+)\)/)?.[1] ?? '';

  const categoryLabel: Record<string, string> = {
    attraction: '관광', restaurant: '맛집', cafe: '카페', shopping: '쇼핑',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="text-xs text-black/40 font-bold uppercase tracking-wider">
            {currentIndex + 1} / {reviewableItems.length} 장소
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded-full transition"
          >
            <X size={18} className="text-black/40" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-black/5 mx-6 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Place info */}
        <div className="px-8 pt-8 pb-4 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-black/5 text-xs font-bold text-black/60 mb-4">
            {categoryLabel[currentItem.category] || currentItem.category}
          </span>
          <h3 className="text-2xl font-serif font-medium mb-1">{koreanName}</h3>
          {localName && (
            <p className="text-sm text-black/40">{localName}</p>
          )}
        </div>

        {/* Star rating */}
        <div className="flex justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setSelectedRating(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className={`transition-colors ${
                  star <= (hoveredStar || selectedRating)
                    ? 'text-orange-400 fill-orange-400'
                    : 'text-black/10'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Rating label */}
        {selectedRating > 0 && (
          <p className="text-center text-sm text-orange-600 font-medium">
            {['', '별로였어요', '아쉬웠어요', '보통이었어요', '좋았어요', '최고였어요!'][selectedRating]}
          </p>
        )}

        {/* Memo input */}
        <div className="px-8 py-4">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="한줄 메모 (선택)"
            maxLength={200}
            className="w-full bg-black/5 rounded-xl px-4 py-3 text-sm placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-8 pb-8">
          <button
            type="button"
            onClick={skip}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-black/5 text-black/50 text-sm font-semibold hover:bg-black/10 transition"
          >
            <SkipForward size={14} />
            건너뛰기
          </button>
          <button
            type="button"
            onClick={saveAndNext}
            disabled={selectedRating === 0 || isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : isLast ? '완료' : '다음'}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
