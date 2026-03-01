/**
 * PreToolUse 훅 — 파일 위치 기반 매뉴얼 자동 주입
 * 편집할 파일 경로를 보고, 해당 매뉴얼 내용을 stdout으로 출력
 * Claude Code는 이 출력을 컨텍스트로 주입함
 */
const fs = require('fs');

process.stdin.setEncoding('utf8');
let rawData = '';

process.stdin.on('data', chunk => { rawData += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(rawData);
    const filePath = (data.tool_input?.file_path || data.tool_input?.path || '').replace(/\\/g, '/');

    if (!filePath) process.exit(0);

    // 파일 위치 기반 관련 매뉴얼 출력
    if (filePath.includes('packages/api') || filePath.includes('.prisma')) {
      const manual = fs.readFileSync('docs/manuals/BACKEND_MANUAL.md', 'utf8');
      console.log('=== [파일 위치 감지: 백엔드] 관련 매뉴얼 ===');
      console.log(manual);
    } else if (filePath.includes('apps/mobile') || filePath.includes('components')) {
      const manual = fs.readFileSync('docs/manuals/FRONTEND_MANUAL.md', 'utf8');
      console.log('=== [파일 위치 감지: 프론트엔드] 관련 매뉴얼 ===');
      console.log(manual);
    } else if (filePath.includes('ai') || filePath.includes('claude') || filePath.includes('prompt')) {
      const manual = fs.readFileSync('docs/manuals/AI_INTEGRATION_MANUAL.md', 'utf8');
      console.log('=== [파일 위치 감지: AI 통합] 관련 매뉴얼 ===');
      console.log(manual);
    }

    process.exit(0); // 항상 0 반환 (비 0이면 도구 실행 차단됨)
  } catch (_e) {
    process.exit(0);
  }
});
