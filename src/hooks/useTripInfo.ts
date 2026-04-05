/**
 * useTripInfo — 날씨 + 환율 데이터를 클라이언트에서 로드한다.
 * React Query 사용, 에러 시 null 반환 (앱 안 깨짐)
 */
import { useQuery } from '@tanstack/react-query';
import type { WeatherForecast, ExchangeRateResult } from '@/types/database';

async function fetchWeather(destination: string, startDate: string, days: number): Promise<WeatherForecast | null> {
  try {
    const res = await fetch(
      `/api/v1/weather?destination=${encodeURIComponent(destination)}&startDate=${startDate}&days=${days}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchExchange(from: string, to: string): Promise<ExchangeRateResult | null> {
  if (from === to) return null;
  try {
    const res = await fetch(`/api/v1/exchange?from=${from}&to=${to}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function useWeather(destination: string, startDate: string, days: number) {
  return useQuery<WeatherForecast | null>({
    queryKey: ['weather', destination, startDate, days],
    queryFn: () => fetchWeather(destination, startDate, days),
    staleTime: 60 * 60 * 1000,    // 1시간
    gcTime: 2 * 60 * 60 * 1000,   // 2시간 캐시 유지
    retry: 1,
    // destination, startDate가 유효할 때만 실행
    enabled: !!destination && !!startDate && days > 0,
  });
}

export function useExchangeRate(from: string, to: string) {
  return useQuery<ExchangeRateResult | null>({
    queryKey: ['exchange', from, to],
    queryFn: () => fetchExchange(from, to),
    staleTime: 6 * 60 * 60 * 1000,   // 6시간
    gcTime: 12 * 60 * 60 * 1000,
    retry: 1,
    enabled: !!from && !!to && from !== to,
  });
}
