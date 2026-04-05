'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  displayName: string;
  createdAt: string;
}

export function useRoomChat(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fetchedRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/v1/rooms/${roomId}/messages?limit=50`);
    if (!res.ok) return;
    const json = await res.json();
    setMessages(json.data ?? []);
  }, [roomId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchMessages();
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // Optimistically add the new message
          // We need display_name which requires a join, so re-fetch
          fetchMessages();
          void payload;
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return false;
    setIsSending(true);
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      return res.ok;
    } finally {
      setIsSending(false);
    }
  }, [roomId]);

  return { messages, isConnected, isSending, sendMessage, refetch: fetchMessages };
}
