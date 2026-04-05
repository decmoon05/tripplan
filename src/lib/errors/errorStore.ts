/**
 * Error Store — API 에러를 인메모리에 보관 (최근 200개)
 * admin/developer가 /api/v1/admin/errors로 조회 가능.
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  statusCode: number;
  errorCode: string;
  message: string;
}

const MAX_ENTRIES = 200;
const entries: ErrorLogEntry[] = [];

export function logError(entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>): void {
  entries.unshift({
    ...entry,
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
}

export function getErrors(limit = 50): ErrorLogEntry[] {
  return entries.slice(0, limit);
}

export function clearErrors(): void {
  entries.length = 0;
}

export function getErrorStats() {
  const last24h = entries.filter(
    (e) => Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000,
  );
  const byCode: Record<string, number> = {};
  for (const e of last24h) {
    byCode[e.statusCode] = (byCode[e.statusCode] || 0) + 1;
  }
  return { total: entries.length, last24h: last24h.length, byStatusCode: byCode };
}
