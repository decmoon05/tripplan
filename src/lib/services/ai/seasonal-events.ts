/**
 * 계절/월별 이벤트 데이터 — AI 프롬프트에 계절 경고 전달용
 */

interface SeasonalEvent {
  destination: string;
  month: number;
  warning: string;
}

const SEASONAL_DATA: SeasonalEvent[] = [
  // 일본
  { destination: '오키나와', month: 7, warning: '7월 오키나와는 스키 불가능 (아열대 기후). 비치/스노클링 시즌.' },
  { destination: '오키나와', month: 8, warning: '8월 태풍 시즌. 야외 활동 영향 가능.' },
  { destination: '홋카이도', month: 12, warning: '12월 라벤더 없음 (라벤더 시즌: 7~8월). 겨울 스키/온천 시즌.' },
  { destination: '교토', month: 8, warning: '8월 단풍 없음 (단풍 시즌: 11월). 폭염 주의.' },
  { destination: '교토', month: 11, warning: '11월 단풍 절정. 관광객 매우 많음. 숙소 조기 예약 필수.' },
  // 한국
  { destination: '제주', month: 8, warning: '8월 태풍 시즌. 우천 대비 실내 일정 필요.' },
  { destination: '서울', month: 7, warning: '7월 장마 시즌. 우산 필수.' },
  // 유럽
  { destination: '아이슬란드', month: 6, warning: '6월 백야 — 오로라 관측 불가. 오로라 시즌: 9~3월.' },
  { destination: '아이슬란드', month: 7, warning: '7월 백야 — 오로라 관측 불가.' },
  // 동남아
  { destination: '방콕', month: 9, warning: '9월 우기 절정. 폭우 빈번.' },
  { destination: '발리', month: 1, warning: '1~2월 우기. 야외 활동 제한.' },
  // 중동
  { destination: '두바이', month: 3, warning: '라마단 기간 가능성 — 낮 시간 식당 제한.' },
  { destination: '두바이', month: 4, warning: '라마단 기간 가능성 — 낮 시간 식당 제한.' },
];

/**
 * 목적지+월에 해당하는 계절 경고를 반환한다.
 */
export function getSeasonalWarnings(destination: string, month: number): string[] {
  const d = destination.toLowerCase();
  return SEASONAL_DATA
    .filter(e => d.includes(e.destination.toLowerCase()) && e.month === month)
    .map(e => e.warning);
}
