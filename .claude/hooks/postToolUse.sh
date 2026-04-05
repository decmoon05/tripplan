#!/bin/bash
# Post-Tool Hook: 작업 완료 후 변경 로그 기록 + 체크 리마인더
# Claude Code 훅 형식: stdin으로 JSON 수신

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
QA_DIR="$PROJECT_DIR/.qa"
mkdir -p "$QA_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 1. 전체 변경 로그 기록 (CCTV)
echo "[$TIMESTAMP] $FILE_PATH" >> "$QA_DIR/changed-files.log"

# 2. 세션 로그 기록 (run-qa.sh 용)
echo "$FILE_PATH" >> "$QA_DIR/current-session.log"

# 3. 품질 체크 리마인더
echo "=== [품질 체크 리마인더] ==="
echo "수정 완료: $FILE_PATH"
echo "- 에러 처리를 누락하지 않았는가?"
echo "- 보안상 위험한 코드(하드코딩 비밀키, SQL 인젝션 등)는 없는가?"
echo "- 네이밍 컨벤션을 준수했는가?"
echo "- 작업 체크리스트를 업데이트했는가?"
echo "==========================="
