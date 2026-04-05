'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useProfileStore } from '@/stores/profileStore';
import { ProfileForm } from '@/components/features/profile/ProfileForm';
import { TripHistory } from '@/components/features/mypage/TripHistory';
import { TravelStats } from '@/components/features/mypage/TravelStats';
import { Loader2, User, Sparkles, Heart, ChevronDown, ChevronUp } from 'lucide-react';

type MyPageTab = '프로필' | '여행 이력' | '통계';

export default function MyPage() {
  const { data: profile, isLoading, error } = useProfile();
  const { setFormData } = useProfileStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<MyPageTab>('프로필');

  // DB 프로필을 스토어에 동기화 (편집 폼에 pre-fill)
  useEffect(() => {
    if (profile) {
      setFormData({
        mbtiStyle: profile.mbtiStyle || '',
        lifestyle: {
          morningType: profile.morningType || '',
          stamina: profile.stamina || '',
          adventureLevel: profile.adventureLevel || '',
          photoStyle: profile.photoStyle || '',
        },
        foodPreference: profile.foodPreference || [],
        interests: profile.interests || [],
        customFoodPreference: profile.customFoodPreference || '',
        customInterests: profile.customInterests || '',
      });
    }
  }, [profile, setFormData]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="text-center py-16">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10">
              <User className="h-8 w-8 text-white/40" />
            </div>
            <h2 className="text-xl font-semibold text-white">프로필이 아직 없습니다</h2>
            <p className="mt-2 text-white/50">온보딩을 완료하면 프로필이 생성됩니다.</p>
            <a
              href="/onboarding"
              className="mt-6 inline-block rounded-full bg-white px-8 py-3 text-sm font-medium text-black transition hover:bg-white/90"
            >
              온보딩 시작하기
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1 text-sm text-white/50">프로필, 여행 이력, 통계를 확인하세요</p>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-6 border-b border-white/10">
          {(['프로필', '여행 이력', '통계'] as MyPageTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === '여행 이력' && (
          <div className="mt-6">
            <TripHistory />
          </div>
        )}

        {activeTab === '통계' && (
          <div className="mt-6">
            <TravelStats />
          </div>
        )}

        {activeTab === '프로필' && (
          <>

        {/* Profile summary card */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
          {/* MBTI */}
          {profile.mbtiStyle && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20">
                <Sparkles className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/40">MBTI</p>
                <p className="font-medium text-white">{profile.mbtiStyle}</p>
              </div>
            </div>
          )}

          {/* Lifestyle */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-white/40">라이프스타일</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.morningType && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{profile.morningType}</span>
                )}
                {profile.stamina && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{profile.stamina}</span>
                )}
                {profile.adventureLevel && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{profile.adventureLevel}</span>
                )}
                {profile.photoStyle && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{profile.photoStyle}</span>
                )}
              </div>
            </div>
          </div>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20">
                <Heart className="h-5 w-5 text-pink-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-white/40">관심사</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.interests.map((interest: string) => (
                    <span key={interest} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Food preferences */}
          {profile.foodPreference && profile.foodPreference.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <span className="text-lg">🍽</span>
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-white/40">음식 취향</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.foodPreference.map((food: string) => (
                    <span key={food} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {food}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle edit form */}
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5"
        >
          {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          프로필 수정
        </button>

        {showForm && (
          <div className="mt-6">
            <ProfileForm isEdit />
          </div>
        )}
        </> /* end 프로필 tab */
        )}
      </div>
    </main>
  );
}
