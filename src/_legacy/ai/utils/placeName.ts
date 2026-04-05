/**
 * 장소명 정규화 + 퍼지 중복 비교 유틸리티.
 *
 * AI가 동일 장소를 다른 표기로 추천할 때 중복 제거에 사용.
 * 예: "센소지 (浅草寺)" vs "아사쿠사 센소지 (浅草寺)" → 중복
 */

/** 괄호(현지어) 제거 + 공백/특수문자 제거 + 소문자 변환 */
export function normalizePlaceName(name: string): string {
  return name
    .replace(/\s*[\(（].*?[\)）]\s*/g, '')
    .replace(/[\s\-·・]/g, '')
    .toLowerCase();
}

/** 정규화된 이름 기준으로 퍼지 중복 판정 (부분 포함 매칭) */
export function isFuzzyDuplicate(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}
