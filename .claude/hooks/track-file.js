/**
 * PostToolUse 훅 — 수정된 파일명 실제 기록
 * Claude Code가 Write/Edit 도구 사용 후 stdin으로 JSON 전달
 * { tool_name, tool_input: { file_path, ... }, tool_response }
 */
process.stdin.setEncoding('utf8');
let rawData = '';

process.stdin.on('data', chunk => { rawData += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(rawData);
    const filePath = data.tool_input?.file_path || data.tool_input?.path || 'unknown';
    const toolName = data.tool_name || 'unknown';
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const fs = require('fs');
    const logPath = '.claude/modified_files.log';

    // 로그 디렉토리 없으면 생성
    if (!fs.existsSync('.claude')) {
      fs.mkdirSync('.claude', { recursive: true });
    }

    fs.appendFileSync(logPath, `[${ts}] [${toolName}] ${filePath}\n`);
  } catch (_e) {
    // 파싱 실패 시 조용히 무시 (훅 오류가 작업 방해하면 안 됨)
  }
});
