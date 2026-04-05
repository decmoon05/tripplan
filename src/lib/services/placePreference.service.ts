import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserPlacePreference, PlacePreference } from '@/types/database';
import { rowToObject } from '@/lib/supabase/helpers';

export async function getPreferences(
  supabase: SupabaseClient,
  userId: string,
  destination: string,
): Promise<UserPlacePreference[]> {
  const { data, error } = await supabase
    .from('user_place_preferences')
    .select('id, user_id, destination, place_name, preference, created_at, updated_at')
    .eq('user_id', userId)
    .eq('destination', destination);

  if (error) throw error;
  return (data || []).map((row) => rowToObject<UserPlacePreference>(row));
}

export async function upsertPreferences(
  supabase: SupabaseClient,
  userId: string,
  destination: string,
  preferences: { placeName: string; preference: PlacePreference }[],
): Promise<void> {
  const rows = preferences.map((p) => ({
    user_id: userId,
    destination,
    place_name: p.placeName,
    preference: p.preference,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('user_place_preferences')
    .upsert(rows, { onConflict: 'user_id,destination,place_name' });

  if (error) throw error;
}
