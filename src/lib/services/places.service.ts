const CACHE_TTL = 30 * 60 * 1000; // 30분

interface CachedPlace {
  data: PlaceDetail;
  timestamp: number;
}

export interface PlaceDetail {
  placeId: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  photos?: string[];
  openingHours?: string[];
  priceLevel?: string;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

function getCacheKey(placeId: string): string {
  return `places:${placeId}`;
}

function getFromCache(placeId: string): PlaceDetail | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(getCacheKey(placeId));
  if (!raw) return null;
  try {
    const cached: CachedPlace = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(getCacheKey(placeId));
      return null;
    }
    return cached.data;
  } catch {
    sessionStorage.removeItem(getCacheKey(placeId));
    return null;
  }
}

function setCache(placeId: string, data: PlaceDetail): void {
  if (typeof window === 'undefined') return;
  const cached: CachedPlace = { data, timestamp: Date.now() };
  sessionStorage.setItem(getCacheKey(placeId), JSON.stringify(cached));
}

export async function searchPlaces(
  query: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
): Promise<PlacePrediction[]> {
  const { AutocompleteService } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
  const service = new AutocompleteService();

  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      {
        input: query,
        sessionToken,
        types: ['establishment', 'geocode'],
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
            return;
          }
          reject(new Error(`Places API error: ${status}`));
          return;
        }
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text,
          })),
        );
      },
    );
  });
}

export async function getPlaceDetail(
  placeId: string,
  mapDiv: HTMLDivElement,
): Promise<PlaceDetail> {
  const cached = getFromCache(placeId);
  if (cached) return cached;

  const { PlacesService } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
  const service = new PlacesService(mapDiv);

  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'rating', 'user_ratings_total', 'formatted_address', 'photos', 'opening_hours', 'price_level'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          reject(new Error(`Place detail error: ${status}`));
          return;
        }
        const detail: PlaceDetail = {
          placeId: place.place_id || placeId,
          name: place.name || '',
          rating: place.rating,
          userRatingCount: place.user_ratings_total,
          formattedAddress: place.formatted_address,
          photos: place.photos?.slice(0, 3).map((p) => p.getUrl({ maxWidth: 400 })),
          openingHours: place.opening_hours?.weekday_text,
          priceLevel: place.price_level != null ? String(place.price_level) : undefined,
        };
        setCache(placeId, detail);
        resolve(detail);
      },
    );
  });
}
