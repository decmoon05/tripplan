'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { MbtiStep } from './steps/MbtiStep';
import { LifestyleStep } from './steps/LifestyleStep';
import { FoodStep } from './steps/FoodStep';
import { InterestsStep } from './steps/InterestsStep';
import { useProfileStore } from '@/stores/profileStore';
import { useSaveProfile } from '@/hooks/useProfile';

const STEP_LABELS = ['MBTI', '여행 성향', '식성', '관심사', '확인'];
const TOTAL_STEPS = 5;

const LIFESTYLE_LABELS: Record<string, Record<string, string>> = {
  morningType: { early: '아침형', moderate: '적당한 아침', late: '늦잠파' },
  stamina: { high: '체력 만렙', moderate: '적당한 체력', low: '효율적 이동' },
  adventureLevel: { explorer: '모험가', balanced: '신중한 모험', cautious: '안전 제일' },
  photoStyle: { sns: 'SNS 감성', casual: '적당한 기록', minimal: '경험 중심' },
};

const INTEREST_LABELS: Record<string, string> = {
  anime: '애니메이션', drama: '드라마 촬영지', kpop: 'K-POP', jpop: 'J-POP',
  'film-location': '영화 촬영지', history: '역사 유적', art: '미술/갤러리',
  museum: '박물관', architecture: '건축물', temple: '사찰/신사',
  nature: '자연 경관', hiking: '하이킹', beach: '해변', 'hot-spring': '온천',
  'theme-park': '테마파크', nightlife: '나이트라이프', festival: '축제/이벤트',
  'local-food': '현지 맛집', 'street-food': '길거리 음식', 'fine-dining': '파인다이닝',
  'cooking-class': '쿠킹 클래스', 'photo-spot': '포토 스팟',
  'shopping-luxury': '명품 쇼핑', 'shopping-vintage': '빈티지/중고',
  'flea-market': '플리마켓', shrine: '신사', religious: '종교 명소',
  sports: '스포츠', surfing: '서핑', skiing: '스키', golf: '골프',
};

interface ProfileFormProps {
  isEdit?: boolean;
}

export function ProfileForm({ isEdit = false }: ProfileFormProps) {
  const router = useRouter();
  const { formData, setFormData, setCompleted } = useProfileStore();
  const saveProfile = useSaveProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.mbtiStyle !== '';
      case 1: {
        const ls = formData.lifestyle;
        return ls.morningType !== '' && ls.stamina !== '' && ls.adventureLevel !== '' && ls.photoStyle !== '';
      }
      case 2: return true; // 식성은 선택사항
      case 3: return true; // 관심사는 선택사항
      case 4: return true; // 확인
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setErrorMessage('');
      setSuccessMessage('');
      try {
        await saveProfile.mutateAsync({
          mbtiStyle: formData.mbtiStyle,
          lifestyle: {
            morningType: formData.lifestyle.morningType,
            stamina: formData.lifestyle.stamina,
            adventureLevel: formData.lifestyle.adventureLevel,
            photoStyle: formData.lifestyle.photoStyle,
          },
          foodPreference: formData.foodPreference,
          interests: formData.interests,
          customFoodPreference: formData.customFoodPreference,
          customInterests: formData.customInterests,
        });
        setCompleted(true);
        if (isEdit) {
          setSuccessMessage('프로필이 저장되었습니다');
        } else {
          router.push('/trips/new');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '프로필 저장에 실패했습니다';
        setErrorMessage(message);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div>
      <StepIndicator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        labels={STEP_LABELS}
      />

      <div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {currentStep === 0 && (
              <MbtiStep
                value={formData.mbtiStyle}
                onChange={(mbti) => setFormData({ mbtiStyle: mbti })}
              />
            )}
            {currentStep === 1 && (
              <LifestyleStep
                value={formData.lifestyle}
                onChange={(lifestyle) => setFormData({ lifestyle })}
              />
            )}
            {currentStep === 2 && (
              <FoodStep
                value={formData.foodPreference}
                onChange={(prefs) => setFormData({ foodPreference: prefs })}
                customValue={formData.customFoodPreference}
                onCustomChange={(v) => setFormData({ customFoodPreference: v })}
              />
            )}
            {currentStep === 3 && (
              <InterestsStep
                value={formData.interests || []}
                onChange={(interests) => setFormData({ interests })}
                customValue={formData.customInterests}
                onCustomChange={(v) => setFormData({ customInterests: v })}
              />
            )}
            {currentStep === 4 && (
              <div className="space-y-6 text-center">
                <h2 className="text-4xl font-light tracking-tight">{isEdit ? '프로필 수정' : '당신의 여행 프로필'}</h2>
                <p className="text-white/40">{isEdit ? '변경할 내용을 수정한 후 저장 버튼을 눌러주세요' : '이 정보를 바탕으로 매 여행마다 맞춤 일정을 만듭니다'}</p>
                <div className="bg-white/5 rounded-3xl p-8 text-left space-y-4">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40">MBTI</span>
                    <span className="font-medium">{formData.mbtiStyle}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40">여행 성향</span>
                    <span className="font-medium capitalize">
                      {Object.entries(formData.lifestyle)
                        .filter(([, val]) => val)
                        .map(([key, val]) => LIFESTYLE_LABELS[key]?.[val] || val)
                        .join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">관심사</span>
                    <span className="font-medium">{(formData.interests || []).length} selected</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {successMessage && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between mt-12">
        <button
          type="button"
          onClick={handleBack}
          className={`flex items-center gap-2 text-white/40 hover:text-white transition-colors ${
            currentStep === 0 ? 'opacity-0' : ''
          }`}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed() || saveProfile.isPending}
          className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium transition-all ${
            canProceed() && !saveProfile.isPending
              ? 'bg-white text-black hover:scale-105'
              : 'bg-white/10 text-white/20 cursor-not-allowed'
          }`}
        >
          <span>
            {currentStep === TOTAL_STEPS - 1
              ? saveProfile.isPending
                ? '저장 중...'
                : isEdit ? '프로필 저장' : '여행 만들러 가기'
              : '다음'}
          </span>
        </button>
      </div>
    </div>
  );
}
