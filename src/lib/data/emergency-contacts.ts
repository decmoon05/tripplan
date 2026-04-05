import type { EmergencyContact } from '@/types/database';

/**
 * 주요 여행지 비상 연락처 정적 데이터
 * 출처: 외교부 해외안전여행 (www.0404.go.kr)
 */
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  // ── 동아시아 ──────────────────────────────────────────────────────────────
  {
    destination: '도쿄',
    country: '일본',
    currency: 'JPY',
    embassy: '+81-3-3452-7611',
    police: '110',
    ambulance: '119',
    fire: '119',
    touristPolice: '03-3501-0110',
    hospitalTip: '종합병원 응급실: 国立医療センター(国立病院)',
  },
  {
    destination: '오사카',
    country: '일본',
    currency: 'JPY',
    embassy: '+81-6-4256-2345',
    police: '110',
    ambulance: '119',
    fire: '119',
    touristPolice: '06-6943-1234',
    hospitalTip: '오사카부립급성기병원 응급 06-6692-1201',
  },
  {
    destination: '도쿄/일본',
    country: '일본',
    currency: 'JPY',
    embassy: '+81-3-3452-7611',
    police: '110',
    ambulance: '119',
    fire: '119',
  },
  {
    destination: '베이징',
    country: '중국',
    currency: 'CNY',
    embassy: '+86-10-8531-0700',
    police: '110',
    ambulance: '120',
    fire: '119',
    hospitalTip: '北京协和医院 응급: 010-69156699',
  },
  {
    destination: '상하이',
    country: '중국',
    currency: 'CNY',
    embassy: '+86-21-6295-5000',
    police: '110',
    ambulance: '120',
    fire: '119',
    hospitalTip: '华山医院 국제부: 021-52889999',
  },
  {
    destination: '타이베이',
    country: '대만',
    currency: 'TWD',
    embassy: '+886-2-2758-8320',
    police: '110',
    ambulance: '119',
    fire: '119',
    touristPolice: '0800-024-111',
    hospitalTip: '台大医院 응급: 02-23123456',
  },
  {
    destination: '홍콩',
    country: '홍콩',
    currency: 'HKD',
    embassy: '+852-2529-4141',
    police: '999',
    ambulance: '999',
    fire: '999',
    touristPolice: '+852-2527-7177',
    hospitalTip: 'Queen Mary Hospital 응급: +852-2855-3838',
  },

  // ── 동남아시아 ────────────────────────────────────────────────────────────
  {
    destination: '방콕',
    country: '태국',
    currency: 'THB',
    embassy: '+66-2-247-7537',
    police: '191',
    ambulance: '1669',
    fire: '199',
    touristPolice: '1155',
    hospitalTip: 'Bumrungrad Hospital: +66-2-667-1000',
  },
  {
    destination: '하노이',
    country: '베트남',
    currency: 'VND',
    embassy: '+84-24-3771-0404',
    police: '113',
    ambulance: '115',
    fire: '114',
    touristPolice: '+84-24-3942-5706',
    hospitalTip: 'Hanoi French Hospital: +84-24-3574-1111',
  },
  {
    destination: '호치민',
    country: '베트남',
    currency: 'VND',
    embassy: '+84-28-3822-5757',
    police: '113',
    ambulance: '115',
    fire: '114',
    touristPolice: '+84-28-3822-8225',
    hospitalTip: 'FV Hospital: +84-28-5411-3333',
  },
  {
    destination: '다낭',
    country: '베트남',
    currency: 'VND',
    embassy: '+84-511-381-5587',
    police: '113',
    ambulance: '115',
    fire: '114',
    hospitalTip: 'Da Nang General Hospital: +84-236-3821-480',
  },
  {
    destination: '싱가포르',
    country: '싱가포르',
    currency: 'SGD',
    embassy: '+65-6256-1188',
    police: '999',
    ambulance: '995',
    fire: '995',
    hospitalTip: 'Singapore General Hospital 응급: +65-6222-3322',
  },
  {
    destination: '쿠알라룸푸르',
    country: '말레이시아',
    currency: 'MYR',
    embassy: '+60-3-4251-2336',
    police: '999',
    ambulance: '999',
    fire: '994',
    touristPolice: '+60-3-2149-6590',
    hospitalTip: 'Gleneagles Hospital KL: +60-3-4141-3000',
  },
  {
    destination: '발리',
    country: '인도네시아',
    currency: 'IDR',
    embassy: '+62-361-222-366',
    police: '110',
    ambulance: '118',
    fire: '113',
    touristPolice: '+62-361-224-111',
    hospitalTip: 'BIMC Hospital Kuta: +62-361-761-263',
  },
  {
    destination: '세부',
    country: '필리핀',
    currency: 'PHP',
    embassy: '+63-32-232-1997',
    police: '117',
    ambulance: '117',
    fire: '117',
    touristPolice: '+63-32-254-1728',
    hospitalTip: 'Chong Hua Hospital: +63-32-255-8000',
  },

  // ── 미주 ─────────────────────────────────────────────────────────────────
  {
    destination: '뉴욕',
    country: '미국',
    currency: 'USD',
    embassy: '+1-646-674-6000',
    police: '911',
    ambulance: '911',
    fire: '911',
    hospitalTip: 'Mount Sinai Hospital 응급: +1-212-241-6500',
  },
  {
    destination: '로스앤젤레스',
    country: '미국',
    currency: 'USD',
    embassy: '+1-213-385-9300',
    police: '911',
    ambulance: '911',
    fire: '911',
    hospitalTip: 'Cedars-Sinai Medical Center: +1-310-423-3277',
  },
  {
    destination: '하와이',
    country: '미국',
    currency: 'USD',
    embassy: '+1-808-595-6109',
    police: '911',
    ambulance: '911',
    fire: '911',
    hospitalTip: 'Queen\'s Medical Center 응급: +1-808-538-9011',
  },

  // ── 유럽 ─────────────────────────────────────────────────────────────────
  {
    destination: '파리',
    country: '프랑스',
    currency: 'EUR',
    embassy: '+33-1-4753-0101',
    police: '17',
    ambulance: '15',
    fire: '18',
    touristPolice: '+33-1-5371-5353',
    hospitalTip: '유럽 공통 응급: 112 / Hôpital Lariboisière 응급: +33-1-4995-6789',
  },
  {
    destination: '런던',
    country: '영국',
    currency: 'GBP',
    embassy: '+44-20-7227-5500',
    police: '999',
    ambulance: '999',
    fire: '999',
    hospitalTip: 'NHS 비응급 의료: 111 / St Thomas\' Hospital A&E: +44-20-7188-7188',
  },

  // ── 오세아니아 ────────────────────────────────────────────────────────────
  {
    destination: '시드니',
    country: '호주',
    currency: 'AUD',
    embassy: '+61-2-9210-0200',
    police: '000',
    ambulance: '000',
    fire: '000',
    hospitalTip: 'Royal Prince Alfred Hospital 응급: +61-2-9515-6111',
  },
];

/**
 * 목적지 이름으로 비상 연락처를 검색한다.
 * 부분 일치 지원 (예: "도쿄" → 도쿄 항목 반환)
 */
export function findEmergencyContact(destination: string): EmergencyContact | null {
  const dest = destination.toLowerCase();

  // 정확한 목적지 매칭
  let contact = EMERGENCY_CONTACTS.find(
    (c) => c.destination.toLowerCase() === dest
  );
  if (contact) return contact;

  // 부분 매칭 (목적지 포함)
  contact = EMERGENCY_CONTACTS.find(
    (c) => dest.includes(c.destination.toLowerCase()) || c.destination.toLowerCase().includes(dest)
  );
  if (contact) return contact;

  // 국가 매칭 (예: "도쿄 하라주쿠" → 일본)
  contact = EMERGENCY_CONTACTS.find(
    (c) => dest.includes(c.country.toLowerCase())
  );
  if (contact) return contact;

  return null;
}
