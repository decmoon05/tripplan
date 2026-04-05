import type { TripItem } from '@/types/database';

/** Haversine distance formula (km) */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Greedy nearest-neighbor route optimization.
 * Items without coordinates are kept in their original relative order
 * at the end of the optimized route.
 *
 * Returns a new array of TripItem with updated orderIndex values.
 */
export function optimizeRoute(items: TripItem[]): TripItem[] {
  if (items.length <= 1) return items;

  const withCoords = items.filter(
    (item) => item.latitude !== null && item.longitude !== null,
  );
  const withoutCoords = items.filter(
    (item) => item.latitude === null || item.longitude === null,
  );

  if (withCoords.length <= 1) return items;

  // Greedy nearest-neighbor starting from the first item
  const visited = new Set<string>();
  const optimized: TripItem[] = [];
  let current = withCoords[0];
  optimized.push(current);
  visited.add(current.id);

  while (optimized.length < withCoords.length) {
    let nearest: TripItem | null = null;
    let nearestDist = Infinity;

    for (const candidate of withCoords) {
      if (visited.has(candidate.id)) continue;
      const dist = haversineDistance(
        current.latitude!,
        current.longitude!,
        candidate.latitude!,
        candidate.longitude!,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = candidate;
      }
    }

    if (!nearest) break;
    optimized.push(nearest);
    visited.add(nearest.id);
    current = nearest;
  }

  // Assign new orderIndex values
  const result = [
    ...optimized.map((item, i) => ({ ...item, orderIndex: i + 1 })),
    ...withoutCoords.map((item, i) => ({
      ...item,
      orderIndex: optimized.length + i + 1,
    })),
  ];

  return result;
}

/** Calculate total route distance for a set of items (km) */
export function calculateRouteDistance(items: TripItem[]): number {
  const withCoords = items
    .filter((i) => i.latitude !== null && i.longitude !== null)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (withCoords.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < withCoords.length - 1; i++) {
    total += haversineDistance(
      withCoords[i].latitude!,
      withCoords[i].longitude!,
      withCoords[i + 1].latitude!,
      withCoords[i + 1].longitude!,
    );
  }
  return Math.round(total * 10) / 10;
}
