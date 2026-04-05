'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { TripItem } from '@/types/database';

const CATEGORY_COLORS: Record<string, string> = {
  attraction: '#4361ee',
  restaurant: '#f97316',
  cafe: '#f59e0b',
  shopping: '#ec4899',
  transport: '#6b7280',
  hotel: '#10b981',
};

const DAY_COLORS = ['#4361ee', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

interface MapViewProps {
  items: TripItem[];
  dayCount: number;
  highlightedItemId?: string | null;
  onMarkerClick?: (itemId: string) => void;
  className?: string;
}

export function MapView({ items, dayCount, highlightedItemId, onMarkerClick, className }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<{ marker: any; itemId: string; pinEl: HTMLDivElement }[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerLibRef = useRef<any>(null);
  const optionsSetRef = useRef(false);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const itemsWithCoords = useMemo(
    () => items.filter((item) => item.latitude != null && item.longitude != null),
    [items],
  );

  // Google Maps API 에러를 window level에서 캐치 (앱 크래시 방지)
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      if (e.message?.includes('ApiNotActivatedMapError') || e.message?.includes('google')) {
        e.preventDefault();
        setMapError('Google Maps API가 활성화되지 않았습니다.');
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  useEffect(() => {
    if (!apiKey || !mapRef.current || itemsWithCoords.length === 0) return;

    if (!optionsSetRef.current) {
      setOptions({ key: apiKey, v: 'weekly' });
      optionsSetRef.current = true;
    }

    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]).then(([mapsLib, markerLib]) => {
      markerLibRef.current = markerLib;
      if (!mapRef.current || mapInstance.current) return;

      const firstItem = itemsWithCoords[0];
      if (firstItem.latitude == null || firstItem.longitude == null) return;
      const center = {
        lat: firstItem.latitude,
        lng: firstItem.longitude,
      };

      mapInstance.current = new mapsLib.Map(mapRef.current, {
        center,
        zoom: 13,
        mapId: 'tripplan-map',
      });

      setMapReady(true);
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ApiNotActivatedMapError') || msg.includes('not activated')) {
        setMapError('Google Maps API가 활성화되지 않았습니다. Google Cloud Console에서 Maps JavaScript API를 활성화해주세요.');
      } else {
        setMapError(`지도 로딩 실패: ${msg}`);
      }
    });
  }, [apiKey, itemsWithCoords]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current) return;

    // 기존 마커/폴리라인 제거
    markersRef.current.forEach((m) => (m.marker.map = null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const filtered = selectedDay === 0
      ? itemsWithCoords
      : itemsWithCoords.filter((i) => i.dayNumber === selectedDay);

    const sorted = [...filtered].sort(
      (a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex,
    );

    if (sorted.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // 마커
    sorted.forEach((item, i) => {
      const position = { lat: item.latitude!, lng: item.longitude! };
      bounds.extend(position);

      const color = CATEGORY_COLORS[item.category] || '#6b7280';

      const pinEl = document.createElement('div');
      pinEl.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${color}; color: white; display: flex;
        align-items: center; justify-content: center;
        font-size: 12px; font-weight: bold; border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
      `;
      pinEl.textContent = String(i + 1);

      const MarkerClass = markerLibRef.current?.AdvancedMarkerElement;
      if (!MarkerClass || !mapInstance.current) return;

      try {
        const marker = new MarkerClass({
          map: mapInstance.current,
          position,
          content: pinEl,
          title: item.placeNameSnapshot,
        });

        marker.addListener('click', () => {
          onMarkerClick?.(item.id);
        });

        markersRef.current.push({ marker, itemId: item.id, pinEl });
      } catch {
        // AdvancedMarkerElement 초기화 실패 — 무시 (지도는 표시, 마커만 안 보임)
      }
    });

    // 일별 경로선
    const dayGroups: Record<number, TripItem[]> = {};
    sorted.forEach((item) => {
      if (!dayGroups[item.dayNumber]) dayGroups[item.dayNumber] = [];
      dayGroups[item.dayNumber].push(item);
    });

    Object.entries(dayGroups).forEach(([day, dayItems]) => {
      if (dayItems.length < 2) return;
      const path = dayItems.map((item) => ({
        lat: item.latitude!,
        lng: item.longitude!,
      }));
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: DAY_COLORS[(Number(day) - 1) % DAY_COLORS.length],
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: mapInstance.current!,
      });
      polylinesRef.current.push(polyline);
    });

    mapInstance.current!.fitBounds(bounds, 60);
  }, [mapReady, selectedDay, itemsWithCoords, onMarkerClick]);

  // 하이라이트 마커 업데이트
  useEffect(() => {
    markersRef.current.forEach(({ itemId, pinEl, marker }) => {
      if (highlightedItemId === itemId) {
        pinEl.style.transform = 'scale(1.4)';
        pinEl.style.boxShadow = '0 0 0 4px rgba(67,97,238,0.3), 0 4px 8px rgba(0,0,0,0.3)';
        pinEl.style.zIndex = '10';
        // 지도 중앙 이동
        if (mapInstance.current && marker.position) {
          const pos = marker.position as google.maps.LatLng | google.maps.LatLngLiteral;
          mapInstance.current.panTo(pos);
        }
      } else {
        pinEl.style.transform = '';
        pinEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        pinEl.style.zIndex = '';
      }
    });
  }, [highlightedItemId]);

  if (!apiKey) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-8 text-center ${className || ''}`}>
        <p className="text-[var(--color-muted)]">
          지도를 표시하려면 Google Maps API 키가 필요합니다.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          .env.local에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className={`rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center ${className || ''}`}>
        <p className="font-medium text-yellow-700">지도를 표시할 수 없습니다</p>
        <p className="mt-1 text-sm text-yellow-600">{mapError}</p>
      </div>
    );
  }

  if (itemsWithCoords.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-8 text-center ${className || ''}`}>
        <p className="text-[var(--color-muted)]">
          좌표 정보가 있는 장소가 없습니다.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          AI 일정을 재생성하거나 실제 AI 프로바이더를 사용하면 좌표가 포함됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-3 flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setSelectedDay(0)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selectedDay === 0
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedDay === day
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Day {day}
          </button>
        ))}
      </div>
      <div
        ref={mapRef}
        className="h-full min-h-[400px] w-full rounded-lg border border-gray-200"
      />
    </div>
  );
}
