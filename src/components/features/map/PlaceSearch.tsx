'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchPlaces, type PlacePrediction } from '@/lib/services/places.service';

interface PlaceSearchProps {
  onSelect: (prediction: PlacePrediction) => void;
  placeholder?: string;
}

export function PlaceSearch({ onSelect, placeholder = '장소 검색...' }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (value: string) => {
    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setSearchError(null);
    try {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
      const predictions = await searchPlaces(value, sessionTokenRef.current);
      setResults(predictions);
      setIsOpen(predictions.length > 0);
    } catch {
      setResults([]);
      setSearchError('장소 검색에 실패했습니다. 직접 입력해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const handleSelect = (prediction: PlacePrediction) => {
    setQuery(prediction.mainText);
    setIsOpen(false);
    setResults([]);
    sessionTokenRef.current = null; // 세션 토큰 리셋
    onSelect(prediction);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
      />
      {isLoading && (
        <div className="absolute right-3 top-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--color-primary)]" />
        </div>
      )}
      {searchError && (
        <p className="mt-1 text-xs text-red-500">{searchError}</p>
      )}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-primary-light)] transition"
              >
                <div className="font-medium">{r.mainText}</div>
                <div className="text-xs text-gray-400">{r.secondaryText}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
