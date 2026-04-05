/**
 * 계절 이벤트 데이터베이스 — feasibilityCheck 및 advisories 경고용
 */

export interface SeasonalEvent {
  keyword: string;
  aliases: string[];
  validMonths: number[];
  warning: string;
}

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    keyword: '단풍',
    aliases: ['autumn leaves', 'foliage', '紅葉', 'koyo', '가을 단풍'],
    validMonths: [10, 11, 12],
    warning: '단풍은 10~12월(지역마다 상이)에 절정입니다. {month}월에는 단풍을 보기 어렵습니다.',
  },
  {
    keyword: '벚꽃',
    aliases: ['cherry blossom', 'sakura', '桜', '꽃놀이', '하나미'],
    validMonths: [3, 4, 5],
    warning: '벚꽃은 3~5월(지역마다 상이)에 만개합니다. {month}월에는 벚꽃을 볼 수 없습니다.',
  },
  {
    keyword: '라벤더',
    aliases: ['lavender', 'ラベンダー'],
    validMonths: [6, 7, 8],
    warning: '라벤더는 6~8월에 절정입니다. {month}월에는 야외 라벤더를 볼 수 없습니다.',
  },
  {
    keyword: '스키',
    aliases: ['ski', 'skiing', 'snowboard', '스노보드', '슬로프', 'スキー'],
    validMonths: [11, 12, 1, 2, 3],
    warning: '스키/스노보드 시즌은 11~3월입니다. {month}월에는 대부분의 스키장이 운영하지 않습니다.',
  },
  {
    keyword: '오로라',
    aliases: ['aurora', 'northern lights', 'オーロラ'],
    validMonths: [9, 10, 11, 12, 1, 2, 3],
    warning: '오로라는 어두운 밤이 필요합니다. {month}월 고위도 지역은 백야(해가 지지 않는 시기)라 오로라를 볼 수 없습니다.',
  },
  {
    keyword: '눈',
    aliases: ['snow', '설경', '겨울 왕국', '눈꽃'],
    validMonths: [11, 12, 1, 2, 3],
    warning: '눈은 보통 11~3월에 볼 수 있습니다. {month}월에는 눈이 오지 않는 곳이 대부분입니다.',
  },
  {
    keyword: '해수욕',
    aliases: ['beach', 'swimming', '바다 수영', '물놀이', '스노쿨링', 'snorkeling'],
    validMonths: [6, 7, 8, 9],
    warning: '해수욕/수영 시즌은 6~9월입니다. {month}월에는 수온이 낮아 해수욕이 어렵습니다.',
  },
  {
    keyword: '불꽃놀이',
    aliases: ['fireworks', '花火', '하나비', '불꽃축제'],
    validMonths: [7, 8],
    warning: '일본 불꽃놀이(花火大会)는 주로 7~8월에 열립니다. {month}월에는 대규모 불꽃놀이가 드뭅니다.',
  },
  {
    keyword: '크리스마스 마켓',
    aliases: ['christmas market', 'Weihnachtsmarkt', '크리스마스마켓'],
    validMonths: [11, 12],
    warning: '크리스마스 마켓은 11~12월에만 운영됩니다. {month}월에는 열리지 않습니다.',
  },
  {
    keyword: '수확 체험',
    aliases: ['harvest', '과일따기', '딸기따기', '포도따기', '귤따기'],
    validMonths: [8, 9, 10, 11],
    warning: '수확 체험은 작물별로 시기가 다릅니다. {month}월에 해당 작물이 수확 가능한지 확인이 필요합니다.',
  },
];

/**
 * 텍스트에서 계절 키워드를 탐색하고, 지정된 월과 비교하여 불일치를 반환.
 */
export function checkSeasonalMismatch(
  text: string,
  month: number,
): { keyword: string; warning: string }[] {
  const lower = text.toLowerCase();
  const mismatches: { keyword: string; warning: string }[] = [];

  for (const event of SEASONAL_EVENTS) {
    const allKeywords = [event.keyword, ...event.aliases];
    const found = allKeywords.some(kw => lower.includes(kw.toLowerCase()));

    if (found && !event.validMonths.includes(month)) {
      mismatches.push({
        keyword: event.keyword,
        warning: event.warning.replace('{month}', String(month)),
      });
    }
  }

  return mismatches;
}
