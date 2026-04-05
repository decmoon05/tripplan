'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Users, Copy, Check, Play, ArrowLeft, MapPin, Calendar, Loader2,
} from 'lucide-react';
import { useRoomRealtime } from '@/hooks/useRoomRealtime';
import { ChatPanel } from '@/components/features/rooms/ChatPanel';
import { VoteButton } from '@/components/features/rooms/VoteButton';

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

interface RoomData {
  id: string;
  host_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: 'gathering' | 'generating' | 'completed';
  trip_id: string | null;
  invite_code: string;
  members: RoomMember[];
}

interface RoomViewProps {
  roomId: string;
  userId: string;
}

export function RoomView({ roomId, userId }: RoomViewProps) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Realtime member sync
  const { members: realtimeMembers, isConnected: isRealtimeConnected } = useRoomRealtime(
    roomId,
    room?.members ?? [],
  );

  // Use realtime members if available, fall back to initial fetch
  const displayMembers = realtimeMembers.length > 0 ? realtimeMembers : (room?.members ?? []);

  useEffect(() => {
    fetchRoom();
  }, [roomId]);

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '방 정보를 불러올 수 없습니다');
      setRoom(json.data);

      // 완료된 방이면 여행 페이지로 이동
      if (json.data.status === 'completed' && json.data.trip_id) {
        router.push(`/trips/${json.data.trip_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/rooms/join?roomId=${roomId}&code=${room?.invite_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/generate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '일정 생성 실패');
      router.push(`/trips/${json.data.tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정 생성에 실패했습니다');
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-serif mb-4">{error || '방을 찾을 수 없습니다'}</h2>
        <button onClick={() => router.push('/dashboard')} className="text-orange-500 hover:text-orange-400">
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  if (generating || room.status === 'generating') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-6" />
        <h2 className="text-3xl font-light tracking-tight mb-2">일정을 종합하고 있습니다...</h2>
        <p className="text-white/60 max-w-md">
          AI가 {room.members.length}명의 선호도를 분석하여 최적의 여행 일정을 만들고 있습니다.
        </p>
      </div>
    );
  }

  const isHost = room.host_id === userId;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-orange-500/30 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드로 돌아가기
        </button>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12">
            <div>
              <h1 className="text-4xl font-serif italic tracking-tight mb-4">여행방</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/60">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span>{room.destination}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span>{room.start_date} ~ {room.end_date}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨!' : '초대 링크 복사'}
              </button>

              {isHost && (
                <button
                  onClick={handleGenerate}
                  disabled={room.members.length < 1}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  일정 생성
                </button>
              )}
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-medium">멤버 ({displayMembers.length})</h2>
              {isRealtimeConnected && (
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-medium">
                  실시간
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayMembers.map((member, idx) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-black/40 border border-white/5 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-sm font-bold">
                      {member.mbtiStyle || '?'}
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.displayName}
                        {member.userId === room.host_id && (
                          <span className="ml-2 text-xs text-orange-500">호스트</span>
                        )}
                      </div>
                      {member.userId === userId && (
                        <div className="text-xs text-white/40">(나)</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-white/70">
                    <div className="flex justify-between">
                      <span className="text-white/40">페이스</span>
                      <span className="capitalize">{member.travelPace}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">예산</span>
                      <span className="capitalize">{member.budgetRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">체력</span>
                      <span className="capitalize">{member.stamina}</span>
                    </div>
                  </div>

                  {member.specialNote && (
                    <p className="mt-3 text-xs text-white/40 italic border-t border-white/5 pt-3">
                      &quot;{member.specialNote}&quot;
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Voting section */}
          {displayMembers.length > 0 && (
            <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
              <h2 className="text-lg font-medium">멤버 투표</h2>
              <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-5">
                <VoteButton
                  roomId={roomId}
                  topic="여행 페이스"
                  options={[
                    { value: 'relaxed', label: '여유롭게' },
                    { value: 'moderate', label: '적당히' },
                    { value: 'active', label: '활동적으로' },
                  ]}
                  currentUserId={userId}
                />
                <VoteButton
                  roomId={roomId}
                  topic="예산 범위"
                  options={[
                    { value: 'budget', label: '알뜰' },
                    { value: 'moderate', label: '적당' },
                    { value: 'comfort', label: '편안하게' },
                  ]}
                  currentUserId={userId}
                />
                <VoteButton
                  roomId={roomId}
                  topic="숙소 타입"
                  options={[
                    { value: 'hostel', label: '게스트하우스' },
                    { value: 'hotel', label: '호텔' },
                    { value: 'airbnb', label: '에어비앤비' },
                  ]}
                  currentUserId={userId}
                />
              </div>
            </div>
          )}

          {/* Chat section */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <h2 className="text-lg font-medium mb-4">채팅</h2>
            <ChatPanel
              roomId={roomId}
              currentUserId={userId}
              currentDisplayName={
                displayMembers.find(m => m.userId === userId)?.displayName ?? '나'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
