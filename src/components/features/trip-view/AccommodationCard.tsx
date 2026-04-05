'use client';

import { useState } from 'react';
import { Hotel, Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface AccommodationSuggestion {
  name: string;
  type: string;
  area: string;
  priceRange: string;
  features: string[];
  googleMapsQuery: string;
}

function getAccommodationSuggestions(destination: string): AccommodationSuggestion[] {
  // Generic suggestions based on destination type
  // In production, this would call Google Places API or a hotel API
  return [
    {
      name: `${destination} 중심부 호텔`,
      type: '호텔',
      area: '도심',
      priceRange: '₩150,000~250,000/박',
      features: ['교통 편리', '관광지 근접', '조식 포함'],
      googleMapsQuery: `hotels in ${destination}`,
    },
    {
      name: `${destination} 에어비앤비`,
      type: '에어비앤비',
      area: '주택가',
      priceRange: '₩80,000~150,000/박',
      features: ['주방 사용', '현지 생활 경험', '넓은 공간'],
      googleMapsQuery: `accommodation ${destination}`,
    },
    {
      name: `${destination} 게스트하우스`,
      type: '게스트하우스',
      area: '여행자 거리',
      priceRange: '₩30,000~70,000/박',
      features: ['저렴한 가격', '여행자 네트워크', '조식 포함'],
      googleMapsQuery: `guesthouse hostel ${destination}`,
    },
  ];
}

interface AccommodationCardProps {
  destination: string;
}

export function AccommodationCard({ destination }: AccommodationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const suggestions = getAccommodationSuggestions(destination);

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-black/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Hotel className="w-5 h-5 text-orange-500" />
          <span className="font-semibold text-sm">숙소 추천</span>
          <span className="text-xs text-black/40">{destination}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-black/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-black/40" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-black/5">
          <p className="text-xs text-black/40 pt-3">
            아래는 일반적인 추천이에요. 실제 예약은 Google 호텔 또는 에어비앤비에서 확인하세요.
          </p>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-[#f5f5f5] rounded-xl"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-black">{s.name}</span>
                  <span className="text-[10px] bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full font-semibold">
                    {s.type}
                  </span>
                </div>
                <p className="text-xs text-black/50 mb-1">{s.area} · {s.priceRange}</p>
                <div className="flex flex-wrap gap-1">
                  {s.features.map((f) => (
                    <span key={f} className="text-[10px] bg-white border border-black/10 text-black/60 px-2 py-0.5 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(s.googleMapsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-1.5 text-black/30 hover:text-orange-500 transition-colors"
                title="Google Maps에서 검색"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
