#!/bin/bash
# Pre-Tool Hook: AI가 도구 사용 전 관련 매뉴얼을 로딩하도록 안내
# Claude Code 훅 형식: stdin으로 JSON 수신

# stdin에서 tool_input의 file_path 추출 (jq 없이 간단 파싱)
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

echo "=== [매뉴얼 시스템 알림] ==="
echo "파일 수정 전 확인사항:"
echo "1. docs/manuals/_index.md를 읽고 관련 매뉴얼을 확인했는가?"
echo "2. 3개 이상 파일 변경 작업이면 docs/tasks/active/에 작업 문서가 있는가?"
echo "3. 대상 파일: $FILE_PATH"

# 경로 기반 매뉴얼 제안
if [[ "$FILE_PATH" == *"backend"* ]] || [[ "$FILE_PATH" == *"server"* ]] || [[ "$FILE_PATH" == *"api"* ]]; then
  echo ">>> 권장 매뉴얼: docs/manuals/backend.md, docs/manuals/api-design.md"
fi
if [[ "$FILE_PATH" == *"frontend"* ]] || [[ "$FILE_PATH" == *"component"* ]] || [[ "$FILE_PATH" == *"page"* ]]; then
  echo ">>> 권장 매뉴얼: docs/manuals/frontend.md"
fi
if [[ "$FILE_PATH" == *"migration"* ]] || [[ "$FILE_PATH" == *"schema"* ]] || [[ "$FILE_PATH" == *"model"* ]]; then
  echo ">>> 권장 매뉴얼: docs/manuals/database.md"
fi
if [[ "$FILE_PATH" == *"auth"* ]] || [[ "$FILE_PATH" == *"security"* ]]; then
  echo ">>> 권장 매뉴얼: docs/manuals/security.md"
fi
echo "==========================="
