'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, MapPin, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { useTripDetail } from '@/hooks/useTripDetail';
import { QuickAddPlace } from '@/components/features/trip-editor/QuickAddPlace';
import { RegenerateButton } from '@/components/features/trip-editor/RegenerateButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { AdvisoriesPanel } from './AdvisoriesPanel';
import { WeatherCard } from './WeatherCard';
import { ExchangeBadge } from './ExchangeBadge';
import { EmergencyInfo } from './EmergencyInfo';
import { PrintButton } from './PrintButton';
import { CalendarExportButton } from './CalendarExportButton';
import { ChecklistPanel } from './ChecklistPanel';
import { BudgetPanel } from './BudgetPanel';
import { AccommodationCard } from './AccommodationCard';
import { ReminderToggle } from './ReminderToggle';
import { PhotoGallery } from './PhotoGallery';
import { TripReviewModal } from './TripReviewModal';
import { useUpdateTrip } from '@/hooks/useTripMutations';
import { useWeather, useExchangeRate } from '@/hooks/useTripInfo';
import { inferCurrencyFromDestination } from '@/lib/services/exchange.service';
import { shareTrip } from '@/lib/api/trips';
import { getDayCount } from '@/utils/date';

type TripTab = '일정' | '준비물' | '예산' | '사진';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-black/5 text-black/40' },
  generated: { label: '생성됨', color: 'bg-orange-500/10 text-orange-600' },
  confirmed: { label: '확정', color: 'bg-green-500/10 text-green-600' },
  completed: { label: '다녀옴', color: 'bg-blue-500/10 text-blue-600' },
};

interface TripDetailViewProps {
  tripId: string;
}

export function TripDetailView({ tripId }: TripDetailViewProps) {
  const { trip, items, isLoading, error } = useTripDetail(tripId);
  const updateTrip = useUpdateTrip();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TripTab>('일정');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratings, setRatings] = useState<Record<string, { rating: number; memo: string | null }>>({});

  // 실시간 정보 (trip 로드 후 활성화)
  const destinationCurrency = trip ? inferCurrencyFromDestination(trip.destination) : 'USD';
  const { data: weatherForecast } = useWeather(
    trip?.destination ?? '',
    trip?.startDate ?? '',
    trip ? getDayCount(trip.startDate, trip.endDate) : 0,
  );
  const { data: exchangeRate } = useExchangeRate('KRW', destinationCurrency);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <ErrorMessage message={error.message} />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-medium text-black">여행을 찾을 수 없습니다</h1>
          <Link href="/dashboard" className="mt-4 inline-block text-orange-500 hover:underline">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const dayCount = getDayCount(trip.startDate, trip.endDate);
  const status = STATUS_LABELS[trip.status] || STATUS_LABELS.draft;

  const dateStr = `${trip.startDate} — ${trip.endDate}`;

  const handleConfirm = () => {
    updateTrip.mutate({
      tripId: trip.id,
      updates: { status: 'confirmed' },
    });
  };

  const handleComplete = () => {
    // 리뷰 모달을 먼저 보여주고, 완료 후 상태 변경
    setShowReviewModal(true);
  };

  const handleReviewComplete = () => {
    setShowReviewModal(false);
    updateTrip.mutate({
      tripId: trip.id,
      updates: { status: 'completed' },
    });
  };

  // 여행 중 여부 판단
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripStart = new Date(trip.startDate + 'T00:00:00');
  const tripEnd = new Date(trip.endDate + 'T00:00:00');
  const isTraveling = trip.status === 'confirmed' && today >= tripStart && today <= tripEnd;
  const isTripPast = trip.status === 'confirmed' && today > tripEnd;
  const todayDayNumber = isTraveling
    ? Math.floor((today.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null;

  const handleShare = async () => {
    setIsSharing(true);
    setShareError(null);
    try {
      const { shareToken } = await shareTrip(trip.id);
      const url = `${window.location.origin}/shared/${shareToken}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : '공유 링크 생성에 실패했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="h-screen bg-[#f5f5f5] text-black flex flex-col selection:bg-orange-500/30">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-black/60 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-serif italic">{trip.destination}</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">
            {dateStr}
          </p>
        </div>
        <div className="flex gap-1 items-center">
          <PrintButton />
          <CalendarExportButton tripId={trip.id} />
          {trip.status !== 'confirmed' && (
            <RegenerateButton
              tripId={trip.id}
              destination={trip.destination}
              startDate={trip.startDate}
              endDate={trip.endDate}
            />
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
            title={shareUrl ? '링크 복사됨!' : 'Share Trip'}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Share feedback */}
      {shareUrl && (
        <div className="bg-green-50 border-b border-green-100 px-6 py-2">
          <p className="text-xs text-green-700 text-center">
            공유 링크가 클립보드에 복사되었습니다
          </p>
        </div>
      )}
      {shareError && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-2">
          <p className="text-xs text-red-600 text-center">{shareError}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border-b border-black/5 px-6">
        <div className="flex gap-1 max-w-3xl mx-auto">
          {(['일정', '준비물', '예산', '사진'] as TripTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-black/50 hover:text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content area: scrollable timeline with hero + map split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline side */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-12 space-y-12">
          <div className="max-w-3xl mx-auto space-y-20">
            {/* Trip Summary Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5 relative overflow-hidden"
            >
              {/* Orange glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold uppercase tracking-widest mb-6">
                  <MapPin className="w-3 h-3" />
                  Trip Overview
                </div>

                {/* Title */}
                <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6 tracking-tight">
                  {trip.destination} Getaway
                </h2>

                {/* Summary */}
                {trip.tripSummary && (
                  <p className="text-lg text-black/70 leading-relaxed mb-8 font-medium">
                    {trip.tripSummary}
                  </p>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-1">Duration</p>
                    <p className="font-medium">{dateStr}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-1">Days</p>
                    <p className="font-medium">{dayCount}일</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-1">Places</p>
                    <p className="font-medium">{items.length}곳</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-1">Status</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                    {trip.status !== 'confirmed' && trip.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={updateTrip.isPending || items.length === 0}
                        className="ml-2 bg-black text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full hover:bg-black/80 transition disabled:opacity-40"
                      >
                        {updateTrip.isPending ? '확정 중...' : '여행 확정'}
                      </button>
                    )}
                    {isTripPast && (
                      <button
                        type="button"
                        onClick={handleComplete}
                        disabled={updateTrip.isPending}
                        className="ml-2 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full hover:bg-blue-600 transition disabled:opacity-40"
                      >
                        {updateTrip.isPending ? '처리 중...' : '다녀왔어요 ✓'}
                      </button>
                    )}
                    {isTraveling && (
                      <span className="ml-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold animate-pulse">
                        🧳 여행 중 · Day {todayDayNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Advisories */}
                {trip.advisories && (
                  <div className="pt-6 border-t border-black/5">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-4 h-4 text-orange-500" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-black/80">Travel Advisories</h3>
                    </div>
                    <AdvisoriesPanel advisories={trip.advisories} />
                  </div>
                )}

                {/* 실시간 날씨 */}
                {weatherForecast && (
                  <WeatherCard
                    forecast={weatherForecast}
                    startDate={trip.startDate}
                    dayCount={dayCount}
                  />
                )}

                {/* 실시간 환율 (국내 여행 제외) */}
                {exchangeRate && destinationCurrency !== 'KRW' && (
                  <ExchangeBadge rate={exchangeRate} targetCurrency={destinationCurrency} />
                )}

                {/* 비상 연락처 */}
                <EmergencyInfo destination={trip.destination} />

                {/* 숙소 추천 */}
                <AccommodationCard destination={trip.destination} />

                {/* 리마인더 설정 */}
                <ReminderToggle tripId={trip.id} />
              </div>
            </motion.div>

            {activeTab === '일정' && (
              <>
                {/* Quick add */}
                <QuickAddPlace tripId={trip.id} dayCount={dayCount} />
                {/* Timeline content rendered via TripView-like inline */}
                <InlineTimelineContent trip={trip} items={items} />
              </>
            )}

            {activeTab === '준비물' && (
              <ChecklistPanel tripId={trip.id} />
            )}

            {activeTab === '예산' && (
              <BudgetPanel tripId={trip.id} items={items} />
            )}

            {activeTab === '사진' && (
              <PhotoGallery tripId={trip.id} dayCount={dayCount} />
            )}
          </div>
        </main>

        {/* Map side */}
        <aside className="flex-1 min-w-0 bg-gray-100 relative hidden md:block">
          <MapView
            items={items}
            dayCount={dayCount}
            highlightedItemId={null}
            onMarkerClick={() => {}}
            className="h-full"
          />
        </aside>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <TripReviewModal
          tripId={trip.id}
          items={items}
          existingRatings={ratings}
          onClose={() => setShowReviewModal(false)}
          onComplete={handleReviewComplete}
        />
      )}
    </div>
  );
}

/* Inline timeline content - renders day columns directly without the TripView wrapper */
import { useCallback, useState as useStateAlias } from 'react';
import { DayColumn } from './DayColumn';
import type { ExpandedSubItem } from './TimelineCard';
import { addDays } from '@/utils/date';
import { formatPriceWithKRW, toKRW } from '@/utils/currency';
import { DollarSign } from 'lucide-react';
import { MapView } from '@/components/features/map/MapView';
import type { Trip as TripType, TripItem as TripItemType } from '@/types/database';

function InlineTimelineContent({ trip, items }: { trip: TripType; items: TripItemType[] }) {
  const dayCount = getDayCount(trip.startDate, trip.endDate);

  // 여행 중이면 오늘의 dayNumber 계산
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const tStart = new Date(trip.startDate + 'T00:00:00');
  const tEnd = new Date(trip.endDate + 'T00:00:00');
  const isCurrentlyTraveling = trip.status === 'confirmed' && todayDate >= tStart && todayDate <= tEnd;
  const currentDayNumber = isCurrentlyTraveling
    ? Math.floor((todayDate.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null;
  const [expandCache, setExpandCache] = useStateAlias<Record<string, ExpandedSubItem[]>>({});
  const [selectionCache, setSelectionCache] = useStateAlias<Record<string, Set<number>>>({});

  const handleSubItemsFetched = useCallback((itemId: string, subItems: ExpandedSubItem[]) => {
    setExpandCache((prev) => ({ ...prev, [itemId]: subItems }));
  }, []);

  const handleSubItemToggle = useCallback((itemId: string, subIndex: number, subItem: ExpandedSubItem) => {
    setSelectionCache((prev) => {
      const current = new Set(prev[itemId] || []);
      const allSubs = expandCache[itemId] || [];
      if (subItem.group) {
        allSubs.forEach((s, i) => {
          if (s.group === subItem.group && i !== subIndex) current.delete(i);
        });
      }
      if (current.has(subIndex)) current.delete(subIndex);
      else current.add(subIndex);
      return { ...prev, [itemId]: current };
    });
  }, [expandCache]);

  const groupedByDay: Record<number, TripItemType[]> = {};
  items.forEach((item) => {
    if (!groupedByDay[item.dayNumber]) groupedByDay[item.dayNumber] = [];
    groupedByDay[item.dayNumber].push(item);
  });

  const currencies = new Set(items.map((i) => i.currency || 'KRW'));
  const isSingleCurrency = currencies.size <= 1;
  const totalCurrency = isSingleCurrency ? (items[0]?.currency || 'KRW') : 'KRW';
  const totalCost = isSingleCurrency
    ? items.reduce((sum, item) => sum + item.estimatedCost, 0)
    : items.reduce((sum, item) => sum + (toKRW(item.estimatedCost, item.currency || 'KRW') ?? item.estimatedCost), 0);

  return (
    <>
      {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
        <DayColumn
          key={day}
          tripId={trip.id}
          dayNumber={day}
          date={addDays(trip.startDate, day - 1)}
          items={groupedByDay[day] || []}
          destination={trip.destination}
          expandCache={expandCache}
          selectionCache={selectionCache}
          onSubItemsFetched={handleSubItemsFetched}
          onSubItemToggle={handleSubItemToggle}
          isToday={currentDayNumber === day}
        />
      ))}

      {/* Total cost card */}
      <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-black/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-orange-500" />
              <span className="text-sm font-semibold text-black">총 예상 비용</span>
            </div>
            <p className="text-xs text-black/40">
              입장료 + 식비 + 교통비 + 카페 등 포함 (숙박비 별도)
            </p>
          </div>
          <span className="text-2xl font-serif font-medium text-orange-600">
            {formatPriceWithKRW(totalCost, totalCurrency, 'estimated')}
          </span>
        </div>
      </div>
    </>
  );
}
