'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  MapPin, Clock, Users, DollarSign, MessageSquare,
  ChevronRight, ChevronLeft, ChevronDown, Plus, Trash2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isBefore, startOfDay, isWithinInterval } from 'date-fns';
import { useProfileStore } from '@/stores/profileStore';
import { useProfile } from '@/hooks/useProfile';
import { useCreateTrip, useGenerateItems } from '@/hooks/useTripMutations';
import type { FullProfileInput } from '@/lib/validators/profile';
import type { PlacePreference, TravelPace, BudgetRange, CompanionType } from '@/types/database';
import type { ArrivalTime } from '@/lib/validators/profile';
import { PlaceExperienceCards } from './PlaceExperienceCards';
import { FeasibilityCheckStep } from './FeasibilityCheckStep';
import { GenerateConfirmStep } from './GenerateConfirmStep';
import { LoadingSteps, StreamingLoadingSteps } from '@/components/ui/LoadingSteps';
import { useStreamGenerate } from '@/hooks/useStreamGenerate';
import { checkFeasibility } from '@/lib/api/trips';
import type { FeasibilityCheckResult, FeasibilityOption } from '@/lib/services/ai/types';

// ---------------------------------------------------------------------------
// Constants (Gemini PreferenceForm style)
// ---------------------------------------------------------------------------

const COMPANIONS: { id: CompanionType; label: string }[] = [
  { id: 'solo', label: '혼자' },
  { id: 'couple', label: '연인/부부' },
  { id: 'friends', label: '친구' },
  { id: 'family', label: '가족 (성인)' },
  { id: 'family-kids', label: '가족 (아이 동반)' },
  { id: 'business', label: '출장/워케이션' },
];

const BUDGET_LABELS: Record<number, { value: BudgetRange; label: string; desc: string }> = {
  0: { value: 'backpacking', label: '배낭여행', desc: '캡슐호텔, 호스텔, 길거리 음식, 대중교통' },
  1: { value: 'budget', label: '알뜰', desc: '저가 호텔/에어비앤비, 캐주얼 식당, 대중교통' },
  2: { value: 'moderate', label: '보통', desc: '3성급 호텔, 괜찮은 현지 식당, 가끔 택시' },
  3: { value: 'comfort', label: '편안', desc: '4성급 호텔, 맛집 위주, 택시 자주 이용' },
  4: { value: 'luxury', label: '럭셔리', desc: '5성급 호텔, 파인다이닝, 전용 차량' },
};

const SPECIAL_SUGGESTIONS = [
  '주술회전 성지순례 코스 넣어주세요',
  '아이가 4살이라 유모차 접근 가능한 곳 위주로',
  '사진 찍기 좋은 인스타 감성 장소 많이',
  '현지인만 아는 숨은 맛집 위주로 추천해주세요',
  '체력이 약해서 걷는 거리 최소화해주세요',
  '한국어 메뉴판 있는 식당 우선',
  '에어소프트건 샵 위주',
  '일렉기타 샵 위주',
];

const PACE_OPTIONS: { value: TravelPace; label: string }[] = [
  { value: 'relaxed', label: '여유로운' },
  { value: 'moderate', label: '보통' },
  { value: 'active', label: '활동적인' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormStep = 1 | 2 | 3 | 4 | 5;
type InternalStep = 'form' | 'feasibility-check' | 'experience' | 'confirm' | 'generating';

interface PlaceSelection {
  placeName: string;
  preference: PlacePreference;
}

interface CompanionPerson {
  id: string;
  gender: 'male' | 'female' | 'other';
  age: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TripCreatorForm() {
  const router = useRouter();
  const { formData: profileData } = useProfileStore();
  const { data: savedProfile } = useProfile();
  const createTrip = useCreateTrip();
  const generateItems = useGenerateItems();
  const streamGenerate = useStreamGenerate();

  // 유저 역할 (admin/developer만 디버그 정보 표시)
  const [userRole, setUserRole] = useState<string>('user');
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data }) => {
        if (data.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('user_id', data.user.id)
            .maybeSingle();
          if (profile?.role) setUserRole(profile.role);
        }
      });
    });
  }, []);

  // Internal flow step
  const [internalStep, setInternalStep] = useState<InternalStep>('form');
  // Form wizard step (1-5)
  const [formStep, setFormStep] = useState<FormStep>(1);

  const [useStreaming, setUseStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityCheckResult | null>(null);
  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<PlaceSelection[] | undefined>();

  // Form data (Gemini PreferenceForm style — all in one state)
  const [destination, setDestination] = useState('');
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [hotelArea, setHotelArea] = useState('');
  const [companion, setCompanion] = useState<CompanionType>('solo');
  const [companionList, setCompanionList] = useState<CompanionPerson[]>([]);
  const [pace, setPace] = useState<TravelPace>('moderate');
  const [budget, setBudget] = useState<BudgetRange>('moderate');
  const [specialRequest, setSpecialRequest] = useState('');

  const profile = savedProfile || profileData;

  // Budget slider index
  const currentBudgetIndex = Object.keys(BUDGET_LABELS).find(
    (k) => BUDGET_LABELS[Number(k)].value === budget,
  ) || '2';

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const isStepValid = () => {
    if (formStep === 1) return !!destination && !!startDate && !!endDate;
    return true;
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleNext = async () => {
    if (formStep < 5) {
      setFormStep((formStep + 1) as FormStep);
      return;
    }

    // Step 5 → feasibility check → experience → generate
    // specialNote, interests, customInterests 중 하나라도 있으면 목적지 불일치 체크
    const hasCheckableContent = specialRequest.trim()
      || (profile?.interests && profile.interests.length > 0)
      || profile?.customInterests;

    if (hasCheckableContent) {
      setFeasibilityLoading(true);
      try {
        const result = await checkFeasibility({
          destination,
          specialNote: specialRequest,
          interests: profile?.interests || undefined,
          customInterests: profile?.customInterests || undefined,
          companion: companion || undefined,
        });
        if (result.status === 'has_concerns') {
          setFeasibilityResult(result);
          setInternalStep('feasibility-check');
          return;
        }
      } catch {
        // 실패 시 조용히 건너뛰기
      } finally {
        setFeasibilityLoading(false);
      }
    }

    setInternalStep('experience');
  };

  const handleBack = () => {
    if (formStep > 1) {
      setFormStep((formStep - 1) as FormStep);
    } else {
      router.push('/dashboard');
    }
  };

  // ---------------------------------------------------------------------------
  // Profile builder
  // ---------------------------------------------------------------------------

  const buildFullProfile = (): FullProfileInput => {
    const lifestyle = savedProfile
      ? {
          morningType: savedProfile.morningType,
          stamina: savedProfile.stamina,
          adventureLevel: savedProfile.adventureLevel,
          photoStyle: savedProfile.photoStyle,
        }
      : profileData.lifestyle || {
          morningType: 'moderate',
          stamina: 'moderate',
          adventureLevel: 'balanced',
          photoStyle: 'casual',
        };

    return {
      mbtiStyle: (savedProfile?.mbtiStyle || profileData.mbtiStyle) || 'ENFP',
      lifestyle,
      foodPreference: (savedProfile?.foodPreference || profileData.foodPreference) || [],
      interests: (savedProfile?.interests || profileData.interests) || [],
      travelPace: pace,
      budgetRange: budget,
      companion,
      specialNote: specialRequest,
      arrivalTime: (arrivalTime || 'undecided') as ArrivalTime,
      hotelArea,
    } as FullProfileInput;
  };

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------

  const handleGenerate = async (selections?: PlaceSelection[]) => {
    setInternalStep('generating');
    setErrorMessage('');

    const tripInput = { destination, startDate, endDate };

    try {
      if (selections && selections.length > 0) {
        await fetch('/api/v1/place-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination, preferences: selections }),
        });
      }

      const trip = await createTrip.mutateAsync(tripInput);
      const fullProfile = buildFullProfile();

      // 스트리밍 먼저 시도
      try {
        setUseStreaming(true);
        streamGenerate.reset();
        await streamGenerate.generate(trip.id, fullProfile, tripInput, selections);
        router.push(`/trips/${trip.id}`);
        return;
      } catch {
        setUseStreaming(false);
      }

      // 비스트리밍 폴백
      await generateItems.mutateAsync({
        tripId: trip.id,
        profile: fullProfile,
        tripInput,
        placePreferences: selections,
      });
      router.push(`/trips/${trip.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '일정 생성에 실패했습니다.';
      setErrorMessage(message);
      setInternalStep('form');
      setFormStep(1);
    }
  };

  // ---------------------------------------------------------------------------
  // Internal step renders
  // ---------------------------------------------------------------------------

  if (internalStep === 'feasibility-check' && feasibilityResult) {
    return (
      <FeasibilityCheckStep
        result={feasibilityResult}
        onSelect={(option: FeasibilityOption) => {
          if (option.action === 'suggest_destination' && option.suggestedDestination) {
            setDestination(option.suggestedDestination);
          }
          if (option.modifiedNote !== undefined) setSpecialRequest(option.modifiedNote);
          setFeasibilityResult(null);
          setInternalStep('experience');
        }}
        onProceedAsIs={() => {
          setFeasibilityResult(null);
          setInternalStep('experience');
        }}
      />
    );
  }

  if (internalStep === 'experience') {
    return (
      <PlaceExperienceCards
        destination={destination}
        onComplete={(selections) => {
          setPendingSelections(selections);
          setInternalStep('confirm');
        }}
        onSkip={() => {
          setPendingSelections(undefined);
          setInternalStep('confirm');
        }}
      />
    );
  }

  if (internalStep === 'confirm') {
    return (
      <GenerateConfirmStep
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        profile={buildFullProfile()}
        placeSelections={pendingSelections}
        specialRequest={specialRequest}
        showDebug={userRole === 'admin' || userRole === 'developer'}
        onConfirm={() => handleGenerate(pendingSelections)}
        onBack={() => setInternalStep('experience')}
      />
    );
  }

  if (internalStep === 'generating') {
    const tripInput = { destination, startDate, endDate };

    if (useStreaming && streamGenerate.isStreaming) {
      return (
        <StreamingLoadingSteps
          title={`${destination} 여행 일정 생성 중`}
          progress={streamGenerate.progress}
          groundingSources={streamGenerate.groundingSources}
          partialItems={streamGenerate.partialItems}
          status={streamGenerate.status as 'streaming' | 'validating' | 'complete' | 'error'}
        />
      );
    }

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-3xl font-light tracking-tight mb-2">일정을 만들고 있습니다...</h2>
        <p className="text-white/40 max-w-sm">
          AI가 {destination}의 최적 여행 일정을 설계하고 있습니다. 잠시만 기다려주세요.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main form wizard (5 steps — Gemini PreferenceForm style)
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Progress bar */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                s <= formStep ? 'bg-orange-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <motion.div
          key={formStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          {/* Step 1: Where & When */}
          {formStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-light tracking-tight flex items-center gap-3">
                <MapPin className="text-orange-500" />
                어디로, 언제?
              </h2>

              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="목적지 (예: 도쿄, 오사카, 제주)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 text-xl"
              />

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                {(() => {
                  const today = startOfDay(new Date());
                  const monthStart = startOfMonth(calendarMonth);
                  const monthEnd = endOfMonth(calendarMonth);
                  const calStart = startOfWeek(monthStart);
                  const calEnd = endOfWeek(monthEnd);
                  const days = eachDayOfInterval({ start: calStart, end: calEnd });
                  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

                  const handleDayClick = (day: Date) => {
                    if (isBefore(day, today)) return;
                    if (!rangeStart || (rangeStart && rangeEnd)) {
                      setRangeStart(day);
                      setRangeEnd(null);
                      setStartDate(format(day, 'yyyy-MM-dd'));
                      setEndDate('');
                    } else {
                      if (isBefore(day, rangeStart)) {
                        setRangeStart(day);
                        setRangeEnd(rangeStart);
                        setStartDate(format(day, 'yyyy-MM-dd'));
                        setEndDate(format(rangeStart, 'yyyy-MM-dd'));
                      } else {
                        setRangeEnd(day);
                        setEndDate(format(day, 'yyyy-MM-dd'));
                      }
                    }
                  };

                  const isInRange = (day: Date) => {
                    if (!rangeStart || !rangeEnd) return false;
                    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
                  };

                  const isStart = (day: Date) => rangeStart && isSameDay(day, rangeStart);
                  const isEnd = (day: Date) => rangeEnd && isSameDay(day, rangeEnd);

                  return (
                    <div className="bg-[#141414] rounded-xl p-6 border border-white/5">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white">
                          {format(calendarMonth, 'yyyy년 M월')}
                        </h3>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-orange-500 hover:bg-white/5 transition">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-orange-500 hover:bg-white/5 transition">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekdays.map((d) => (
                          <div key={d} className="text-center text-xs text-white/40 font-medium py-2">{d}</div>
                        ))}
                      </div>

                      {/* Days grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((day) => {
                          const inMonth = isSameMonth(day, calendarMonth);
                          const isNextMonth = !inMonth && day > monthEnd;
                          const isPast = isBefore(day, today);
                          const isToday = isSameDay(day, today) && inMonth;
                          const selected = inMonth && (isStart(day) || isEnd(day));
                          const inRange = inMonth && isInRange(day) && !selected;
                          const disabled = !inMonth && !isNextMonth || isPast;

                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              disabled={false}
                              onClick={() => {
                                if (isNextMonth) {
                                  setCalendarMonth(addMonths(calendarMonth, 1));
                                } else if (!disabled) {
                                  handleDayClick(day);
                                }
                              }}
                              className={`
                                h-10 w-full rounded-lg text-sm font-medium transition-all
                                ${!inMonth && !isNextMonth ? 'invisible' : ''}
                                ${isNextMonth ? 'text-white/30 cursor-pointer hover:text-white/50' : ''}
                                ${disabled && !isNextMonth ? 'text-white/10 cursor-not-allowed' : ''}
                                ${inMonth && !disabled && !selected && !inRange && !isToday ? 'text-white/80 hover:bg-white/10 cursor-pointer' : ''}
                                ${isToday && !selected ? 'text-orange-500 font-bold' : ''}
                                ${selected ? 'bg-orange-500 text-white font-bold' : ''}
                                ${inRange ? 'bg-orange-500/20 text-orange-200' : ''}
                              `}
                            >
                              {inMonth ? day.getDate() : isNextMonth ? day.getDate() : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {startDate && endDate && (
                  <p className="mt-3 text-center text-sm text-white/60">
                    {startDate} ~ {endDate}
                  </p>
                )}
                {startDate && !endDate && (
                  <p className="mt-3 text-center text-sm text-orange-500/60">
                    귀국일을 선택하세요
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Arrival & Stay */}
          {formStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-light tracking-tight flex items-center gap-3">
                <Clock className="text-orange-500" />
                도착 & 숙소
              </h2>
              <div className="space-y-4">
                <label className="text-xs uppercase tracking-widest text-white/40 block">도착 시간</label>
                <div className="relative">
                  <select
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 appearance-none"
                  >
                    <option value="" className="bg-[#0a0a0a] text-white">선택하세요</option>
                    <option value="morning" className="bg-[#0a0a0a] text-white">오전</option>
                    <option value="afternoon" className="bg-[#0a0a0a] text-white">오후</option>
                    <option value="evening" className="bg-[#0a0a0a] text-white">저녁</option>
                    <option value="undecided" className="bg-[#0a0a0a] text-white">미정</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <ChevronDown className="w-5 h-5 text-white/40" />
                  </div>
                </div>
                <label className="text-xs uppercase tracking-widest text-white/40 block">숙소 지역</label>
                <input
                  type="text"
                  value={hotelArea}
                  onChange={(e) => setHotelArea(e.target.value)}
                  placeholder="예: 신주쿠, 난바, 명동"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Companion */}
          {formStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-light tracking-tight flex items-center gap-3">
                <Users className="text-orange-500" />
                이번 여행, 누구와 가나요?
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {COMPANIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompanion(c.id)}
                    className={`py-4 rounded-xl border transition-all ${
                      companion === c.id
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Companion Details */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white/80">동행자 상세</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCompanionList([
                        ...companionList,
                        { id: Date.now().toString(), gender: 'male', age: 25 },
                      ]);
                    }}
                    className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    추가
                  </button>
                </div>

                <div className="space-y-3">
                  {companionList.map((person, index) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/5"
                    >
                      <span className="text-xs font-bold text-white/30 w-6">#{index + 1}</span>
                      <select
                        value={person.gender}
                        onChange={(e) => {
                          const newList = [...companionList];
                          newList[index] = { ...person, gender: e.target.value as 'male' | 'female' | 'other' };
                          setCompanionList(newList);
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-orange-500 appearance-none"
                      >
                        <option value="male" className="bg-[#0a0a0a]">남성</option>
                        <option value="female" className="bg-[#0a0a0a]">여성</option>
                        <option value="other" className="bg-[#0a0a0a]">기타</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={person.age}
                          onChange={(e) => {
                            const newList = [...companionList];
                            newList[index] = { ...person, age: Number(e.target.value) || 0 };
                            setCompanionList(newList);
                          }}
                          className="w-16 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-center focus:outline-none focus:border-orange-500"
                        />
                        <span className="text-xs text-white/40">세</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompanionList(companionList.filter((p) => p.id !== person.id))}
                        className="p-2 text-white/20 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {companionList.length === 0 && (
                    <p className="text-xs text-white/40 text-center py-4">
                      동행자가 없습니다. &quot;추가&quot;를 클릭하여 상세 정보를 입력하세요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Pace & Budget */}
          {formStep === 4 && (
            <div className="space-y-8">
              <h2 className="text-4xl font-light tracking-tight flex items-center gap-3">
                <DollarSign className="text-orange-500" />
                페이스 & 예산
              </h2>
              <div className="space-y-4">
                <label className="text-xs uppercase tracking-widest text-white/40 block">여행 페이스</label>
                <div className="flex gap-3">
                  {PACE_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPace(p.value)}
                      className={`flex-1 py-4 rounded-xl border capitalize transition-all ${
                        pace === p.value
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-8 pt-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs uppercase tracking-widest text-white/40 block">예산 수준</label>
                  <span className="text-orange-500 font-medium">
                    {BUDGET_LABELS[Number(currentBudgetIndex)].label}
                  </span>
                </div>

                <div className="relative px-2">
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={currentBudgetIndex}
                    onChange={(e) => setBudget(BUDGET_LABELS[Number(e.target.value)].value)}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between mt-3 text-xs text-white/40 px-1">
                    <span>배낭</span>
                    <span>알뜰</span>
                    <span>보통</span>
                    <span>편안</span>
                    <span>럭셔리</span>
                  </div>
                </div>
                <p className="text-sm text-white/60 bg-white/5 p-4 rounded-xl border border-white/10">
                  {BUDGET_LABELS[Number(currentBudgetIndex)].desc}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Special Requests */}
          {formStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-light tracking-tight flex items-center gap-3">
                <MessageSquare className="text-orange-500" />
                특별히 원하는 게 있나요?
              </h2>
              <textarea
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                placeholder="예: 원피스 성지순례 코스 넣어주세요, 또는 아이가 좋아하는 캐릭터 샵 위주로..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-orange-500 h-40 resize-none"
              />
              <div className="flex flex-wrap gap-2 mt-4">
                {SPECIAL_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      const current = specialRequest;
                      setSpecialRequest(current ? `${current}\n${suggestion}` : suggestion);
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/70 transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-12">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>이전</span>
          </button>

          <button
            type="button"
            disabled={!isStepValid() || feasibilityLoading}
            onClick={handleNext}
            className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all ${
              isStepValid()
                ? 'bg-white text-black hover:scale-105'
                : 'bg-white/10 text-white/20 cursor-not-allowed'
            }`}
          >
            <span>
              {feasibilityLoading
                ? '확인 중...'
                : formStep === 5
                  ? '다음: 장소 경험'
                  : '계속'}
            </span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
