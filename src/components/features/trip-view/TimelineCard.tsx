'use client';

import { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock, CheckCircle, AlertCircle, DollarSign,
  Edit2, Trash2, RefreshCw, GripVertical,
  MapPin, Navigation, Sparkles, Star,
} from 'lucide-react';
import { EditItemModal } from '@/components/features/trip-editor/EditItemModal';
import { useDeleteItem, useUpdateItem } from '@/hooks/useTripMutations';
import type { TripItem } from '@/types/database';
import { formatPriceWithKRW } from '@/utils/currency';

function StarRating({ tripId, itemId }: { tripId: string; itemId: string }) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  const handleRate = async (value: number) => {
    setRating(value);
    setSaved(false);
    try {
      await fetch(`/api/v1/trips/${tripId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, rating: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setRating(0);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={(e) => { e.stopPropagation(); handleRate(star); }}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
          title={`${star}점`}
        >
          <Star
            className={`w-3.5 h-3.5 transition-colors ${
              star <= (hover || rating)
                ? 'text-orange-400 fill-orange-400'
                : 'text-black/15'
            }`}
          />
        </button>
      ))}
      {saved && <span className="text-[10px] text-green-600 ml-1">저장됨</span>}
    </div>
  );
}

function splitPlaceName(name: string): { korean: string; local: string | null } {
  const match = name.match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { korean: match[1].trim(), local: match[2].trim() };
  return { korean: name, local: null };
}

/** HH:MM:SS -> HH:MM */
function formatTime(t: string): string {
  if (!t) return '';
  return t.length > 5 ? t.slice(0, 5) : t;
}

export interface ExpandedSubItem {
  name: string;
  description: string;
  estimatedCost: number;
  currency: string;
  category: string;
  selectable?: boolean;
  group?: string;
}

interface TimelineCardProps {
  tripId: string;
  item: TripItem;
  index: number;
  isLast: boolean;
  destination: string;
  cachedSubItems?: ExpandedSubItem[];
  selectedSubItems?: Set<number>;
  onSubItemsFetched?: (itemId: string, subItems: ExpandedSubItem[]) => void;
  onSubItemToggle?: (itemId: string, subIndex: number, subItem: ExpandedSubItem) => void;
  isHighlighted?: boolean;
  onHover?: (itemId: string | null) => void;
  onClick?: (itemId: string) => void;
}

export function TimelineCard({
  tripId, item, index, isLast, destination,
  cachedSubItems, selectedSubItems,
  onSubItemsFetched, onSubItemToggle,
  isHighlighted, onHover, onClick,
}: TimelineCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingSub, setIsLoadingSub] = useState(false);
  const deleteItem = useDeleteItem(tripId);
  const updateItem = useUpdateItem(tripId);

  const subItems = cachedSubItems || [];
  const selected = selectedSubItems || new Set<number>();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = () => {
    if (confirm(`"${item.placeNameSnapshot}" 일정을 삭제하시겠습니까?`)) {
      deleteItem.mutate(item.id);
    }
  };

  const handleExpand = useCallback(async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    // Use cached sub-items if available
    if (subItems.length > 0) {
      setIsExpanded(true);
      return;
    }

    // Check DB-stored subActivities
    if (item.subActivities && item.subActivities.length > 0) {
      const mapped: ExpandedSubItem[] = item.subActivities.map((sa) => ({
        name: sa.name,
        description: sa.description,
        estimatedCost: 0,
        currency: 'KRW',
        category: item.category,
        selectable: false,
      }));
      onSubItemsFetched?.(item.id, mapped);
      setIsExpanded(true);
      return;
    }

    setIsLoadingSub(true);
    try {
      const res = await fetch('/api/v1/ai/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeName: item.placeNameSnapshot,
          category: item.category,
          destination,
          itemId: item.id,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        onSubItemsFetched?.(item.id, json.data);
        setIsExpanded(true);
      }
    } catch (err) {
      // expand failed
    } finally {
      setIsLoadingSub(false);
    }
  }, [isExpanded, subItems.length, item.id, item.placeNameSnapshot, item.category, item.subActivities, destination, onSubItemsFetched]);

  const handleToggleSub = (subIndex: number, sub: ExpandedSubItem) => {
    onSubItemToggle?.(item.id, subIndex, sub);
  };

  // Selected sub-item cost sum
  const selectedCost = subItems.reduce((sum, sub, i) => {
    if (selected.has(i)) return sum + sub.estimatedCost;
    return sum;
  }, 0);

  const handleApplySubCost = async () => {
    if (selectedCost <= 0) return;
    const subCurrency = subItems.find((_, i) => selected.has(i))?.currency || item.currency || 'KRW';
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        updates: {
          estimatedCost: selectedCost,
          currency: subCurrency,
          priceConfidence: 'estimated',
        },
      });
    } catch (err) {
      // cost update failed
    }
  };

  const { korean, local } = splitPlaceName(item.placeNameSnapshot);

  // Group sub-items (same group = radio, no group = checkbox)
  const groups: Record<string, number[]> = {};
  subItems.forEach((sub, i) => {
    if (sub.group) {
      if (!groups[sub.group]) groups[sub.group] = [];
      groups[sub.group].push(i);
    }
  });

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="relative group"
        id={`timeline-card-${item.id}`}
      >
        {/* Timeline dot */}
        <div className="absolute -left-[49px] md:-left-[73px] top-4 w-4 h-4 rounded-full bg-white border-2 border-black group-hover:scale-125 transition-transform z-10" />

        {/* Card */}
        <div
          className={`bg-white rounded-[2rem] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border transition-all cursor-pointer ${
            isHighlighted
              ? 'border-orange-400 shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
              : 'border-black/5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]'
          }`}
          onMouseEnter={() => onHover?.(item.id)}
          onMouseLeave={() => onHover?.(null)}
          onClick={() => onClick?.(item.id)}
        >
          {/* Time row: time + category + cost + actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              {/* Drag handle */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-black/20 hover:text-black/40 transition"
                title="드래그하여 순서 변경"
              >
                <GripVertical size={16} />
              </div>

              {/* Clock icon container */}
              <div className="p-2.5 bg-black/5 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>

              {/* Time */}
              <span className="font-mono text-sm font-semibold tracking-tight">
                {formatTime(item.startTime)} - {formatTime(item.endTime)}
              </span>

              {/* Category badge */}
              <span className="px-3 py-1 bg-black text-white text-[9px] uppercase tracking-widest font-black rounded-full">
                {item.category}
              </span>

              {/* Verified badge */}
              {item.verified !== false ? (
                <div title="Verified Place">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              ) : (
                <AlertCircle className="w-4 h-4 text-orange-400" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Cost */}
              {item.estimatedCost > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium text-black/60 mr-4">
                  <DollarSign className="w-4 h-4" />
                  <span>
                    {formatPriceWithKRW(item.estimatedCost, item.currency || 'KRW', item.priceConfidence || 'estimated')}
                  </span>
                </div>
              )}

              {/* Hover action buttons */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsEditOpen(true); }}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="p-2 hover:bg-rose-50 rounded-full transition-colors text-black/40 hover:text-rose-500"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Place name + AI Details button */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h4 className="text-2xl font-medium tracking-tight">{korean}</h4>
              {local && (
                <p className="text-sm text-black/40 mt-0.5">{local}</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleExpand(); }}
              disabled={isLoadingSub}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {isLoadingSub ? '로딩...' : isExpanded ? '접기' : 'AI Details'}
            </button>
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="text-black/60 leading-relaxed text-sm mb-6 max-w-2xl">
              {item.notes}
            </p>
          )}

          {/* Address & business hours */}
          {(item.address || item.businessHours || item.closedDays) && (
            <div className="space-y-1 mb-6 text-xs text-black/40">
              {item.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-orange-500 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin size={12} />
                  {item.address}
                </a>
              )}
              {(item.businessHours || item.closedDays) && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {[item.businessHours, item.closedDays && `${item.closedDays} 휴무`].filter(Boolean).join(' | ')}
                </div>
              )}
            </div>
          )}

          {/* Reason tags */}
          {item.reasonTags && item.reasonTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {item.reasonTags.map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] uppercase tracking-wider font-bold text-black/40 bg-black/5 px-3 py-1.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* AI Expanded sub-items */}
          {isExpanded && subItems.length > 0 && (
            <div className="mt-6 pt-6 border-t border-black/5">
              <div className="space-y-2">
                {subItems.map((sub, i) => {
                  const isSelected = selected.has(i);
                  const isGrouped = !!sub.group;
                  const isRadio = isGrouped && groups[sub.group!]?.length > 1;

                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm cursor-pointer transition ${
                        isSelected ? 'bg-orange-50' : 'hover:bg-black/[0.02]'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sub.selectable !== false && (
                        <input
                          type={isRadio ? 'radio' : 'checkbox'}
                          name={isRadio ? `${item.id}-${sub.group}` : undefined}
                          checked={isSelected}
                          onChange={() => handleToggleSub(i, sub)}
                          className="shrink-0 accent-orange-500"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-black/80 font-medium">{sub.name}</span>
                        <span className="ml-2 text-xs text-black/40">{sub.description}</span>
                      </div>
                      {sub.estimatedCost > 0 && (
                        <span className="shrink-0 text-xs font-medium text-orange-600">
                          {formatPriceWithKRW(sub.estimatedCost, sub.currency || 'KRW', 'estimated')}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selected.size > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-black/40">
                    선택 합계:{' '}
                    <span className="font-semibold text-orange-600">
                      {formatPriceWithKRW(selectedCost, subItems.find((_, i) => selected.has(i))?.currency || 'KRW', 'estimated')}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleApplySubCost(); }}
                    disabled={updateItem.isPending}
                    className="bg-black text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full hover:bg-black/80 transition disabled:opacity-50"
                  >
                    {updateItem.isPending ? '적용 중...' : '가격 반영'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Transit info */}
          {!isLast && item.transitMode && (
            <div className="pt-6 border-t border-black/5 flex flex-wrap items-center gap-2 md:gap-4 text-xs text-black/40 font-medium">
              <div className="flex items-center gap-2 shrink-0">
                <Navigation className="w-3 h-3" />
                <span className="capitalize">{item.transitMode}</span>
              </div>
              {item.transitDurationMin && (
                <>
                  <span className="shrink-0">&bull;</span>
                  <span className="shrink-0">{item.transitDurationMin} min</span>
                </>
              )}
              {item.transitSummary && (
                <>
                  <span className="shrink-0">&bull;</span>
                  <span className="italic font-normal">{item.transitSummary}</span>
                </>
              )}
            </div>
          )}

          {/* Star rating */}
          <div className="mt-4 pt-3 border-t border-black/5 flex items-center gap-2">
            <span className="text-[10px] text-black/30 font-medium">평가</span>
            <StarRating tripId={tripId} itemId={item.id} />
          </div>
        </div>
      </div>

      <EditItemModal
        key={item.id}
        tripId={tripId}
        item={item}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
}
