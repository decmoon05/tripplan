#!/bin/bash
# 수정 파일 추적 스크립트 (CCTV)
# 용도: 수동 호출용 (record/clear/show)
# 자동 기록은 .claude/hooks/postToolUse.sh에서 처리

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
QA_DIR="$PROJECT_DIR/.qa"
LOG_FILE="$QA_DIR/changed-files.log"
SESSION_FILE="$QA_DIR/current-session.log"

# QA 디렉토리 생성
mkdir -p "$QA_DIR"

ACTION="$1"    # record | clear | show
FILE="$2"

case "$ACTION" in
  record)
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] $FILE" >> "$LOG_FILE"
    echo "$FILE" >> "$SESSION_FILE"
    echo "[CCTV] 기록됨: $FILE"
    ;;
  clear)
    # 새 세션 시작 시 세션 로그 초기화
    > "$SESSION_FILE"
    echo "[CCTV] 세션 로그 초기화됨"
    ;;
  show)
    if [ -f "$SESSION_FILE" ] && [ -s "$SESSION_FILE" ]; then
      echo "=== 이번 세션 수정 파일 목록 ==="
      sort -u "$SESSION_FILE"
      echo "================================"
      echo "총 $(sort -u "$SESSION_FILE" | wc -l)개 파일"
    else
      echo "수정된 파일 없음"
    fi
    ;;
  *)
    echo "사용법: track-changes.sh [record|clear|show] [파일경로]"
    ;;
esac
