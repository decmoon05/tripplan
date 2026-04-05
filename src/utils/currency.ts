const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: '₩',
  JPY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  THB: '฿',
  VND: '₫',
  TWD: 'NT$',
  PHP: '₱',
  SGD: 'S$',
  MYR: 'RM',
  IDR: 'Rp',
  AUD: 'A$',
  CAD: 'C$',
};

// 정적 환율 테이블 (1 외화 = X 원, 2026-03 기준 근사값)
// TODO: 추후 환율 API 연동으로 교체
const EXCHANGE_RATES_TO_KRW: Record<string, number> = {
  KRW: 1,
  JPY: 9.5,
  USD: 1450,
  EUR: 1580,
  GBP: 1840,
  CNY: 200,
  THB: 42,
  VND: 0.06,
  TWD: 45,
  PHP: 25,
  SGD: 1080,
  MYR: 310,
  IDR: 0.09,
  AUD: 940,
  CAD: 1050,
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function toKRW(cost: number, currency: string): number | null {
  if (currency === 'KRW') return null; // 이미 원화
  const rate = EXCHANGE_RATES_TO_KRW[currency];
  if (!rate) return null;
  return Math.round(cost * rate);
}

export function formatPrice(
  cost: number,
  currency: string,
  confidence: 'confirmed' | 'estimated',
): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = cost.toLocaleString();
  const prefix = confidence === 'estimated' ? '~' : '';
  return `${prefix}${symbol}${formatted}`;
}

export function formatPriceWithKRW(
  cost: number,
  currency: string,
  confidence: 'confirmed' | 'estimated',
): string {
  const main = formatPrice(cost, currency, confidence);
  const krw = toKRW(cost, currency);
  if (krw === null) return main;
  return `${main} (~₩${krw.toLocaleString()})`;
}
