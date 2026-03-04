import { ProfileQuestion } from '@tripwise/shared';

/**
 * 고정 프로파일링 질문 12개
 * - personality: 4개 (여행 스타일, 페이스, 취향, 우선순위)
 * - food: 3개 (음식 취향, 가격대, 식이제한)
 * - activity: 3개 (활동 선호, 자연/도시, 쇼핑)
 * - social: 2개 (동행 스타일, 현지인 교류)
 */
export const PROFILE_QUESTIONS: readonly ProfileQuestion[] = [
  // === personality (4개) ===
  {
    id: 'p1_planning',
    text: '여행 일정을 꼼꼼하게 짜는 편인가요?',
    category: 'personality',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
  {
    id: 'p2_pace',
    text: '하루에 많은 곳을 돌아보는 빡빡한 일정을 선호하나요?',
    category: 'personality',
    answerOptions: ['yes', 'no', 'doesnt_matter', 'custom'],
  },
  {
    id: 'p3_spontaneous',
    text: '여행 중 즉흥적으로 일정을 바꾸는 것을 좋아하나요?',
    category: 'personality',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
  {
    id: 'p4_priority',
    text: '여행에서 가장 중요한 것은 무엇인가요?',
    category: 'personality',
    answerOptions: ['custom'],
  },

  // === food (3개) ===
  {
    id: 'f1_local',
    text: '현지 로컬 음식을 적극적으로 시도하는 편인가요?',
    category: 'food',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
  {
    id: 'f2_budget',
    text: '식사에 돈을 아끼지 않는 편인가요?',
    category: 'food',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
  {
    id: 'f3_dietary',
    text: '특별한 식이 제한이 있나요? (채식, 할랄, 알레르기 등)',
    category: 'food',
    answerOptions: ['yes', 'no', 'custom'],
  },

  // === activity (3개) ===
  {
    id: 'a1_active',
    text: '등산, 스노클링 등 활동적인 체험을 좋아하나요?',
    category: 'activity',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
  {
    id: 'a2_nature',
    text: '자연 경관(산, 바다, 공원)을 도시 관광보다 선호하나요?',
    category: 'activity',
    answerOptions: ['yes', 'no', 'doesnt_matter', 'custom'],
  },
  {
    id: 'a3_shopping',
    text: '여행지에서 쇼핑하는 시간을 따로 확보하고 싶나요?',
    category: 'activity',
    answerOptions: ['yes', 'no', 'doesnt_matter', 'custom'],
  },

  // === social (2개) ===
  {
    id: 's1_companion',
    text: '주로 누구와 함께 여행하나요?',
    category: 'social',
    answerOptions: ['custom'],
  },
  {
    id: 's2_local_interaction',
    text: '현지인과의 교류(시장, 투어 등)를 즐기나요?',
    category: 'social',
    answerOptions: ['yes', 'no', 'depends', 'custom'],
  },
];
