import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/database';
import { rowToProfile } from '@/lib/supabase/helpers';

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select()
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToProfile(data);
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: {
    mbtiStyle: string;
    lifestyle: {
      morningType: string;
      stamina: string;
      adventureLevel: string;
      photoStyle: string;
    };
    foodPreference: string[];
    interests?: string[];
    customFoodPreference?: string;
    customInterests?: string;
  },
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        mbti_style: profile.mbtiStyle,
        morning_type: profile.lifestyle.morningType,
        stamina: profile.lifestyle.stamina,
        adventure_level: profile.lifestyle.adventureLevel,
        photo_style: profile.lifestyle.photoStyle,
        food_preference: profile.foodPreference,
        interests: profile.interests || [],
        custom_food_preference: profile.customFoodPreference || '',
        custom_interests: profile.customInterests || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return rowToProfile(data);
}
