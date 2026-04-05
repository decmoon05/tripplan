'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RoomView } from '@/components/features/room/RoomView';
import { Loader2 } from 'lucide-react';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return <RoomView roomId={roomId} userId={userId} />;
}
