/**
 * Stop 훅 — 세션 종료 시 수정된 파일 기반 품질 검사
 * modified_files.log를 읽어 어떤 파일이 수정됐는지 파악 후
 * 파일 유형별 맞춤 체크리스트 출력
 */
const fs = require('fs');

const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const logPath = '.claude/modified_files.log';

// 로그에서 수정 파일 목록 읽기 (중복 제거, 최근 30개 기준)
function getModifiedFiles() {
  if (!fs.existsSync(logPath)) return [];
  const log = fs.readFileSync(logPath, 'utf8').trim();
  if (!log) return [];

  const files = log.split('\n')
    .slice(-30)
    .map(line => {
      // "[2026-03-02 12:00:00] [Write] /path/to/file" 형식에서 경로 추출
      const match = line.match(/\] \[(?:Write|Edit)\] (.+)$/);
      return match ? match[1].trim() : null;
    })
    .filter(f => f && f !== 'unknown' && !f.includes('modified_files.log'));

  return [...new Set(files)]; // 중복 제거
}

const files = getModifiedFiles();

console.log('\n' + SEP);
console.log('  작업 완료 — 보고서 및 품질 체크');
console.log(SEP);

// 수정된 파일 목록 출력
if (files.length > 0) {
  console.log('\n[이번 작업에서 수정된 파일 목록]');
  files.forEach(f => {
    // 파일 존재 여부 표시
    const exists = fs.existsSync(f.replace(/^\//, '')) || fs.existsSync(f);
    console.log(`  ${exists ? '·' : '?'} ${f}`);
  });
} else {
  console.log('\n[수정된 파일 없음 — 주로 조회/분석 작업이었던 경우]');
}

// ── 공통 체크리스트 ──
console.log('\n[공통 체크리스트]');
console.log('□ 요청한 기능만 구현했는가? (과잉 개발 없음)');
console.log('□ docs/02_TODO.md 체크 업데이트 완료했는가?');
console.log('□ 수정한 파일에 TypeScript 에러 없는가?');

// ── 파일 유형별 추가 체크 ──
const hasBackend  = files.some(f => f.includes('packages/api') || f.includes('.prisma') || f.includes('middleware') || f.includes('route') || f.includes('controller') || f.includes('service'));
const hasFrontend = files.some(f => f.includes('apps/mobile') || f.includes('components') || f.includes('screens') || f.includes('hooks') || f.includes('stores'));
const hasAI       = files.some(f => f.includes('/ai/') || f.includes('claude') || f.includes('prompt') || f.includes('anthropic'));
const hasSchema   = files.some(f => f.includes('.prisma'));
const hasEnv      = files.some(f => f.includes('.env') || f.includes('config'));

if (hasBackend) {
  console.log('\n[백엔드 추가 체크]');
  console.log('□ 모든 async 함수에 try-catch 있는가?');
  console.log('□ 사용자 입력에 zod 검증 적용했는가?');
  console.log('□ 환경변수를 process.env로만 읽는가? (하드코딩 없음)');
  console.log('□ API 응답 형식이 { success, data/error } 형식인가?');
}

if (hasSchema) {
  console.log('\n[DB 스키마 체크]');
  console.log('□ created_at, updated_at 필드 포함했는가?');
  console.log('□ 마이그레이션 필요한 변경이면 db:push 실행했는가?');
  console.log('□ prisma generate 실행해 클라이언트 재생성했는가?');
}

if (hasFrontend) {
  console.log('\n[프론트엔드 추가 체크]');
  console.log('□ API 에러 시 사용자에게 피드백(토스트/메시지) 있는가?');
  console.log('□ 로딩 상태(isLoading) 처리 있는가?');
  console.log('□ FlatList를 ScrollView+map 대신 사용했는가?');
}

if (hasAI) {
  console.log('\n[AI 통합 체크]');
  console.log('□ API 키가 서버 사이드에만 있는가? (클라이언트 노출 없음)');
  console.log('□ AI 응답 JSON 파싱 실패 시 폴백 처리 있는가?');
  console.log('□ Redis 캐시 키 설정했는가? (비용 절약)');
}

if (hasEnv) {
  console.log('\n[환경변수 체크]');
  console.log('□ .env 파일이 .gitignore에 포함됐는가?');
  console.log('□ .env.example도 함께 업데이트했는가?');
}

// ── 파일 수 많을 때 경고 ──
if (files.length >= 5) {
  console.log(`\n⚠  수정 파일이 ${files.length}개로 많습니다.`);
  console.log('   → Quality 에이전트에게 코드 리뷰를 요청하세요:');
  console.log('   "방금 수정한 파일들을 Quality 에이전트로 검토해줘"');
}

// ── 보고서 형식 상기 ──
console.log('\n[완료 보고 필수 형식]');
console.log('1. 무엇을 발견했는가 (기존 코드 분석 결과)');
console.log('2. 무엇을 수정/추가했는가 (변경 사항 목록)');
console.log('3. 왜 그렇게 판단했는가 (결정 이유)');
console.log('4. 다음에 할 것 (TODO에서 다음 항목)');

console.log('\n' + SEP);

// 로그 초기화 (세션 종료 시 다음 세션을 위해)
try {
  fs.writeFileSync(logPath, '');
} catch (_e) {}
