'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { MapPin, Calendar, Users, ArrowLeft } from 'lucide-react';

export default function NewRoomPage() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const isValid = destination && startDate && endDate;

  const handleCreate = async () => {
    if (!isValid) return;
    setIsCreating(true);
    setError('');
    try {
      const res = await fetch('/api/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, startDate, endDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || '방 생성 실패');
      router.push(`/rooms/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방 생성에 실패했습니다');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          대시보드로 돌아가기
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <Users className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-serif italic tracking-tight">여행방 만들기</h1>
              <p className="text-sm text-white/40 mt-1">
                친구들과 함께 여행 계획을 세워보세요
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-white/40 block">
                <MapPin className="w-3 h-3 inline mr-1" />
                목적지
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="예: 도쿄, 오사카, 제주"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-white/40 block">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  출발일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-white/40 block">
                  귀국일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={!isValid || isCreating}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-full font-medium text-lg transition-all ${
                isValid
                  ? 'bg-white text-black hover:scale-[1.02]'
                  : 'bg-white/10 text-white/20 cursor-not-allowed'
              }`}
            >
              {isCreating ? '생성 중...' : '방 만들기'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
