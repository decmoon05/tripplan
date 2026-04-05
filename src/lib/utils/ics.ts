import type { Trip, TripItem } from '@/types/database';

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/:/g, '\\:')        // prevent header injection via colon
    .replace(/[\r\n]/g, '\\n'); // escape BOTH CR and LF (RFC 5545 injection fix)
}

function toICSDate(dateStr: string, timeStr?: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const date = dateStr.replace(/-/g, '');
  if (!timeStr) return `${date}`;
  const time = timeStr.replace(':', '') + '00';
  return `${date}T${time}`;
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@tripplan`;
}

export function generateICS(trip: Trip, items: TripItem[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TripPlan//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(trip.destination)} 여행`,
    `X-WR-CALDESC:${escapeICS(trip.destination)} 여행 일정 (${trip.startDate} ~ ${trip.endDate})`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  // Add trip overview event (all-day)
  lines.push(
    'BEGIN:VEVENT',
    `UID:trip-${trip.id}@tripplan`,
    `DTSTART;VALUE=DATE:${toICSDate(trip.startDate)}`,
    `DTEND;VALUE=DATE:${toICSDate(trip.endDate)}`,
    `SUMMARY:✈️ ${escapeICS(trip.destination)} 여행`,
    trip.tripSummary ? `DESCRIPTION:${escapeICS(trip.tripSummary)}` : 'DESCRIPTION:',
    'END:VEVENT',
  );

  // Add each trip item as an event
  for (const item of items) {
    // Calculate the actual date for this item based on day number
    const startDate = new Date(trip.startDate);
    startDate.setDate(startDate.getDate() + item.dayNumber - 1);
    const dateStr = startDate.toISOString().slice(0, 10);

    const hasTime = item.startTime && item.startTime !== '00:00';
    const dtstart = hasTime
      ? `DTSTART:${toICSDate(dateStr, item.startTime)}`
      : `DTSTART;VALUE=DATE:${toICSDate(dateStr)}`;

    const dtend = hasTime && item.endTime && item.endTime !== '00:00'
      ? `DTEND:${toICSDate(dateStr, item.endTime)}`
      : dtstart.replace('DTSTART', 'DTEND');

    const descParts: string[] = [];
    if (item.notes) descParts.push(item.notes);
    if (item.estimatedCost > 0) descParts.push(`예상 비용: ${item.estimatedCost.toLocaleString()} ${item.currency || 'KRW'}`);
    if (item.address) descParts.push(`주소: ${item.address}`);
    if (item.businessHours) descParts.push(`운영시간: ${item.businessHours}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:item-${item.id}@tripplan`,
      dtstart,
      dtend,
      `SUMMARY:Day${item.dayNumber} ${escapeICS(item.placeNameSnapshot)} (${escapeICS(item.category)})`,
      `DESCRIPTION:${escapeICS(descParts.join('\\n'))}`,
      item.latitude && item.longitude ? `GEO:${item.latitude};${item.longitude}` : '',
      `CATEGORIES:${escapeICS(item.category)}`,
      `SEQUENCE:0`,
      `STATUS:CONFIRMED`,
      `TRANSP:OPAQUE`,
      `END:VEVENT`,
    );
  }

  lines.push('END:VCALENDAR');

  // Filter empty lines and join with CRLF (ICS spec)
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}
