/**
 * OSM opening_hours 파서
 *
 * OSM 형식 ("Mo-Fr 09:00-18:00") → 한국어 영업시간 + closedDays 변환
 * 문서: https://wiki.openstreetmap.org/wiki/Key:opening_hours
 */

const OSM_TO_KO: Record<string, string> = {
  Mo: '월', Tu: '화', We: '수', Th: '목', Fr: '금', Sa: '토', Su: '일',
};

const ALL_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const ALL_DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * OSM opening_hours를 한국어 영업시간 + closedDays로 변환한다.
 *
 * @example
 * parseOsmOpeningHours("Mo-Fr 09:00-18:00; Sa 10:00-17:00")
 * → { businessHours: "월~금 09:00-18:00, 토 10:00-17:00", closedDays: "일요일" }
 *
 * parseOsmOpeningHours("24/7")
 * → { businessHours: "24시간 영업", closedDays: null }
 */
export function parseOsmOpeningHours(osmFormat: string): {
  businessHours: string | null;
  closedDays: string | null;
} {
  if (!osmFormat || osmFormat.trim() === '') {
    return { businessHours: null, closedDays: null };
  }

  const trimmed = osmFormat.trim();

  // 24/7
  if (trimmed === '24/7') {
    return { businessHours: '24시간 영업', closedDays: null };
  }

  // "off" 또는 "closed"
  if (trimmed.toLowerCase() === 'off' || trimmed.toLowerCase() === 'closed') {
    return { businessHours: '휴업', closedDays: null };
  }

  // 세미콜론으로 분리 ("Mo-Fr 09:00-18:00; Sa 10:00-17:00")
  const parts = trimmed.split(';').map(p => p.trim()).filter(Boolean);
  const openDays = new Set<string>();
  const koSegments: string[] = [];

  for (const part of parts) {
    const parsed = parseSegment(part);
    if (parsed) {
      koSegments.push(parsed.ko);
      for (const day of parsed.days) openDays.add(day);
    }
  }

  // 영업시간 한국어
  const businessHours = koSegments.length > 0 ? koSegments.join(', ') : trimmed;

  // closedDays: 전체 요일 - 열린 요일
  const closedDays = ALL_DAYS
    .filter(d => !openDays.has(d))
    .map(d => OSM_TO_KO[d] + '요일')
    .join(', ');

  return {
    businessHours,
    closedDays: closedDays || null, // 매일 열면 null
  };
}

/**
 * 단일 세그먼트 파싱 ("Mo-Fr 09:00-18:00" 또는 "Sa,Su 10:00-17:00")
 */
function parseSegment(segment: string): { ko: string; days: string[] } | null {
  // 패턴 1: "Mo-Fr 09:00-18:00" (범위)
  const rangeMatch = segment.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\s+(.+)$/);
  if (rangeMatch) {
    const startIdx = ALL_DAYS.indexOf(rangeMatch[1]);
    const endIdx = ALL_DAYS.indexOf(rangeMatch[2]);
    if (startIdx >= 0 && endIdx >= 0) {
      const days = ALL_DAYS.slice(startIdx, endIdx + 1);
      const startKo = OSM_TO_KO[rangeMatch[1]];
      const endKo = OSM_TO_KO[rangeMatch[2]];
      return { ko: `${startKo}~${endKo} ${rangeMatch[3]}`, days };
    }
  }

  // 패턴 2: "Mo,We,Fr 14:00-21:00" (개별)
  const listMatch = segment.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
  if (listMatch) {
    const dayList = listMatch[1].split(',');
    const days = dayList.filter(d => ALL_DAYS.includes(d));
    const koList = days.map(d => OSM_TO_KO[d]).join(',');
    return { ko: `${koList} ${listMatch[2]}`, days };
  }

  // 패턴 3: "09:00-18:00" (요일 없음 → 매일)
  const timeOnlyMatch = segment.match(/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/);
  if (timeOnlyMatch) {
    return { ko: `매일 ${segment}`, days: [...ALL_DAYS] };
  }

  // 패턴 4: "PH off" (공휴일) → 무시
  if (segment.includes('PH')) return null;

  // 매칭 실패 → 원문 그대로
  return { ko: segment, days: [...ALL_DAYS] };
}
