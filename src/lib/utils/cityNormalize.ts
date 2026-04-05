/**
 * 도시명 정규화 — 같은 대도시를 다른 표기로 입력해도 매칭
 * "오사카 3박4일" → "오사카", "Osaka, Japan" → "오사카"
 */

const CITY_ALIASES: Record<string, string[]> = {
  '오사카': ['osaka', '大阪', 'おおさか'],
  '도쿄': ['tokyo', '東京', '동경', 'とうきょう'],
  '교토': ['kyoto', '京都', 'きょうと'],
  '후쿠오카': ['fukuoka', '福岡'],
  '삿포로': ['sapporo', '札幌'],
  '나고야': ['nagoya', '名古屋'],
  '오키나와': ['okinawa', '沖縄'],
  '서울': ['seoul'],
  '부산': ['busan'],
  '제주': ['jeju', '제주도', '제주시'],
  '대전': ['daejeon'],
  '인천': ['incheon'],
  '방콕': ['bangkok', 'กรุงเทพ'],
  '치앙마이': ['chiang mai', 'chiangmai'],
  '파리': ['paris'],
  '런던': ['london'],
  '로마': ['rome', 'roma'],
  '바르셀로나': ['barcelona'],
  '뉴욕': ['new york', 'nyc'],
  '하와이': ['hawaii', 'honolulu'],
  '괌': ['guam'],
  '다낭': ['da nang', 'danang'],
  '호치민': ['ho chi minh', 'saigon'],
  '하노이': ['hanoi'],
  '싱가포르': ['singapore'],
  '타이베이': ['taipei', '台北'],
  '홍콩': ['hong kong', '香港'],
  '시드니': ['sydney'],
  '발리': ['bali'],
  '세부': ['cebu'],
};

// 역방향 맵 (alias → 한국어 대표명)
const REVERSE_MAP = new Map<string, string>();
for (const [korean, aliases] of Object.entries(CITY_ALIASES)) {
  REVERSE_MAP.set(korean.toLowerCase(), korean);
  for (const alias of aliases) {
    REVERSE_MAP.set(alias.toLowerCase(), korean);
  }
}

/**
 * 목적지 문자열에서 핵심 도시명 추출.
 * "오사카 3박4일 가족여행" → "오사카"
 * "Tokyo, Japan" → "도쿄"
 */
export function normalizeCity(destination: string): string {
  const lower = destination.toLowerCase().trim();

  // 정확한 매칭 먼저 시도
  if (REVERSE_MAP.has(lower)) return REVERSE_MAP.get(lower)!;

  // 부분 매칭: 목적지 문자열에 도시명이 포함되어 있는지
  for (const [key, canonical] of REVERSE_MAP) {
    if (lower.includes(key)) return canonical;
  }

  // 매칭 실패: 첫 단어(공백/쉼표 기준) 반환
  return destination.split(/[\s,·]+/)[0].trim();
}

/**
 * 두 목적지가 같은 대도시인지 비교.
 */
export function isSameCity(a: string, b: string): boolean {
  return normalizeCity(a) === normalizeCity(b);
}
