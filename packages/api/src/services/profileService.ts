import { UserProfile, ProfileQuestion, ProfileAnswer } from '@tripwise/shared';
import { AppError } from '../middlewares/errorHandler';
import * as profileRepo from '../repositories/profileRepository';
import { PROFILE_QUESTIONS } from '../data/profileQuestions';
import { UpdateProfileInput, ProfileCompleteInput } from '../types/validations';

/**
 * PersonalityData JSON 구조 (Prisma Json 필드에 저장)
 * - 프로파일링 답변 + 파싱된 성격 데이터를 합쳐서 저장
 */
interface PersonalityData {
  planningStyle?: 'spontaneous' | 'structured' | 'mixed';
  pace?: 'relaxed' | 'moderate' | 'packed';
  preference?: 'urban' | 'nature' | 'mixed';
  companions?: string;
  priorities?: {
    budget: number;
    experience: number;
    food: number;
    accommodation: number;
  };
  foodPreferences?: {
    cuisines: string[];
    priceRange: string;
    dietary?: string[];
  };
  answers?: ProfileAnswer[];
}

/**
 * 내 프로필 조회
 * - Prisma JSON → 공유 타입 변환
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const profile = await profileRepo.findByUserId(userId);
  if (!profile) {
    throw new AppError('PROFILE_NOT_FOUND', 404, '프로필이 아직 생성되지 않았습니다.');
  }

  const data = profile.personalityData as PersonalityData;

  return {
    id: profile.id,
    personality: {
      planningStyle: data.planningStyle ?? 'mixed',
      pace: data.pace ?? 'moderate',
      preference: data.preference ?? 'mixed',
      companions: data.companions as UserProfile['personality']['companions'],
      priorities: {
        budget: (data.priorities?.budget ?? 3) as 1 | 2 | 3 | 4 | 5,
        experience: (data.priorities?.experience ?? 3) as 1 | 2 | 3 | 4 | 5,
        food: (data.priorities?.food ?? 3) as 1 | 2 | 3 | 4 | 5,
        accommodation: (data.priorities?.accommodation ?? 3) as 1 | 2 | 3 | 4 | 5,
      },
    },
    interests: profile.interests,
    foodPreferences: {
      cuisines: data.foodPreferences?.cuisines ?? [],
      priceRange: (data.foodPreferences?.priceRange ?? 'mid') as 'budget' | 'mid' | 'premium',
      dietary: data.foodPreferences?.dietary,
    },
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * 프로필 수정 (수동 업데이트)
 * - 기존 personalityData와 merge
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const existing = await profileRepo.findByUserId(userId);
  const existingData = (existing?.personalityData as PersonalityData) ?? {};

  const mergedData: PersonalityData = {
    ...existingData,
    ...(input.personality && {
      planningStyle: input.personality.planningStyle,
      pace: input.personality.pace,
      preference: input.personality.preference,
      companions: input.personality.companions,
      priorities: input.personality.priorities,
    }),
    ...(input.foodPreferences && {
      foodPreferences: input.foodPreferences,
    }),
  };

  const interests = input.interests ?? existing?.interests ?? [];

  await profileRepo.upsert(userId, {
    personalityData: mergedData as object,
    interests,
  });

  return getProfile(userId);
}

/**
 * 프로파일링 질문 목록 반환 (고정 12개)
 */
export function getQuestions(): readonly ProfileQuestion[] {
  return PROFILE_QUESTIONS;
}

/**
 * 프로파일링 완료 — 답변 저장
 * - 답변 기반으로 personality 속성 자동 추출
 * - AI 보충질문은 Phase 1에서 stub (빈 배열 반환)
 */
export async function completeProfile(
  userId: string,
  input: ProfileCompleteInput
): Promise<{
  profile: UserProfile;
  followUpQuestions: ProfileQuestion[];
}> {
  const personality = analyzeAnswers(input.answers);

  const personalityData: PersonalityData = {
    ...personality,
    answers: input.answers,
  };

  const interests = extractInterests(input.answers);

  await profileRepo.upsert(userId, {
    personalityData: personalityData as object,
    interests,
  });

  const profile = await getProfile(userId);

  // AI 보충질문 — Phase 1에서는 stub (빈 배열)
  const followUpQuestions: ProfileQuestion[] = [];

  return { profile, followUpQuestions };
}

/**
 * 답변에서 성격 속성 추출 (규칙 기반)
 * - Phase 2에서 AI 기반 분석으로 교체 예정
 */
function analyzeAnswers(answers: ProfileAnswer[]): Partial<PersonalityData> {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  // planningStyle 추출
  const planning = answerMap.get('p1_planning');
  let planningStyle: PersonalityData['planningStyle'] = 'mixed';
  if (planning?.answer === 'yes') planningStyle = 'structured';
  if (planning?.answer === 'no') planningStyle = 'spontaneous';

  // pace 추출
  const pace_answer = answerMap.get('p2_pace');
  let pace: PersonalityData['pace'] = 'moderate';
  if (pace_answer?.answer === 'yes') pace = 'packed';
  if (pace_answer?.answer === 'no') pace = 'relaxed';

  // preference 추출
  const nature = answerMap.get('a2_nature');
  let preference: PersonalityData['preference'] = 'mixed';
  if (nature?.answer === 'yes') preference = 'nature';
  if (nature?.answer === 'no') preference = 'urban';

  // companions 추출
  const companion = answerMap.get('s1_companion');
  const companions = companion?.customText ?? 'solo';

  // foodPreferences 추출
  const foodBudget = answerMap.get('f2_budget');
  let priceRange = 'mid';
  if (foodBudget?.answer === 'yes') priceRange = 'premium';
  if (foodBudget?.answer === 'no') priceRange = 'budget';

  const dietary = answerMap.get('f3_dietary');
  const dietaryList = dietary?.answer === 'yes' && dietary.customText
    ? dietary.customText.split(',').map((s) => s.trim())
    : [];

  return {
    planningStyle,
    pace,
    preference,
    companions,
    priorities: { budget: 3, experience: 3, food: 3, accommodation: 3 },
    foodPreferences: {
      cuisines: [],
      priceRange,
      dietary: dietaryList.length > 0 ? dietaryList : undefined,
    },
  };
}

/**
 * 답변에서 관심사(interests) 추출
 */
function extractInterests(answers: ProfileAnswer[]): string[] {
  const interests: string[] = [];
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  if (answerMap.get('a1_active')?.answer === 'yes') interests.push('outdoor_activities');
  if (answerMap.get('a2_nature')?.answer === 'yes') interests.push('nature');
  if (answerMap.get('a3_shopping')?.answer === 'yes') interests.push('shopping');
  if (answerMap.get('f1_local')?.answer === 'yes') interests.push('local_food');
  if (answerMap.get('s2_local_interaction')?.answer === 'yes') interests.push('cultural_exchange');

  return interests;
}
