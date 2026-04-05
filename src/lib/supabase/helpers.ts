// snake_case DB row → camelCase TypeScript object

import type { Trip, TripItem, UserProfile } from '@/types/database';

// Generic converters
function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function rowToObject<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamelKey(key)] = value;
  }
  return result as T;
}

export function objectToRow<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnakeKey(key)] = value;
  }
  return result;
}

// Type-specific converters for clarity
export function rowToTrip(row: Record<string, unknown>): Trip {
  return rowToObject<Trip>(row);
}

export function rowToTripItem(row: Record<string, unknown>): TripItem {
  return rowToObject<TripItem>(row);
}

export function rowToProfile(row: Record<string, unknown>): UserProfile {
  return rowToObject<UserProfile>(row);
}
