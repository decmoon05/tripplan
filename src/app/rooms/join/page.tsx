'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Users, Loader2 } from 'lucide-react';

function JoinRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const code = searchParams.get('code');

  const [displayName, setDisplayName] = useState('');
  const [mbtiStyle, setMbtiStyle] = useState('');
  const [travelPace, setTravelPace] = useState('moderate');
  const [budgetRange, setBudgetRange] = useState('moderate');
  const [stamina, setStamina] = useState('moderate');
  const [specialNote, setSpecialNote] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  if (!roomId || !code) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-serif mb-4">잘못된 초대 링크입니다</h2>
        <button onClick={() => router.push('/dashboard')} className="text-orange-500">대시보드로</button>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!displayName) return;
    setIsJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: code,
          displayName,
          mbtiStyle,
          travelPace,
          budgetRange,
          stamina,
          specialNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '참가 실패');
      router.push(`/rooms/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '참가에 실패했습니다');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-white/5 border border-white/10 rounded-3xl p-8"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <Users className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-serif italic">여행방 참가</h1>
            <p className="text-sm text-white/40">내 여행 성향을 입력해주세요</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">이름 (닉네임)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="예: 민수"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">MBTI</label>
            <input
              type="text"
              value={mbtiStyle}
              onChange={(e) => setMbtiStyle(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="예: ENFP"
              maxLength={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">여행 페이스</label>
            <div className="flex gap-2">
              {['relaxed', 'moderate', 'active'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTravelPace(p)}
                  className={`flex-1 py-3 rounded-xl border text-sm capitalize transition ${
                    travelPace === p ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  {p === 'relaxed' ? '여유' : p === 'moderate' ? '보통' : '활동적'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">체력</label>
            <div className="flex gap-2">
              {['low', 'moderate', 'high'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStamina(s)}
                  className={`flex-1 py-3 rounded-xl border text-sm capitalize transition ${
                    stamina === s ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  {s === 'low' ? '약함' : s === 'moderate' ? '보통' : '강함'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-2">특별 요청</label>
            <textarea
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              placeholder="예: 일본 라멘 맛집 많이 넣어주세요"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-20 resize-none focus:outline-none focus:border-orange-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}

          <button
            type="button"
            onClick={handleJoin}
            disabled={!displayName || isJoining}
            className={`w-full py-4 rounded-full font-medium transition-all ${
              displayName ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/10 text-white/20 cursor-not-allowed'
            }`}
          >
            {isJoining ? '참가 중...' : '방에 참가하기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function JoinRoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    }>
      <JoinRoomContent />
    </Suspense>
  );
}
