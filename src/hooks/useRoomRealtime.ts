'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RoomMember {
  id: string;
  userId: string;
  displayName: string;
  mbtiStyle: string;
  travelPace: string;
  budgetRange: string;
  stamina: string;
  specialNote: string | null;
}

interface RoomRealtimeState {
  members: RoomMember[];
  isConnected: boolean;
}

function mapMember(raw: Record<string, unknown>): RoomMember {
  return {
    id: raw.id as string,
    userId: raw.user_id as string,
    displayName: raw.display_name as string,
    mbtiStyle: raw.mbti_style as string,
    travelPace: raw.travel_pace as string,
    budgetRange: raw.budget_range as string,
    stamina: raw.stamina as string,
    specialNote: raw.special_note as string | null,
  };
}

export function useRoomRealtime(roomId: string, initialMembers: RoomMember[] = []) {
  const [state, setState] = useState<RoomRealtimeState>({
    members: initialMembers,
    isConnected: false,
  });

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('travel_room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (data) {
      setState(prev => ({ ...prev, members: data.map(mapMember) }));
    }
  }, [roomId]);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    fetchMembers();

    // Subscribe to realtime changes on room members
    const channel = supabase
      .channel(`room-members-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'travel_room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Re-fetch on any change
          fetchMembers();
        },
      )
      .subscribe((status) => {
        setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMembers]);

  return state;
}
