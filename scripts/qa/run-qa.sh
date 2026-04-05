#!/bin/bash
# 자동 품질 검사 스크립트
# 용도: 작업 완료 시 수정된 파일을 대상으로 품질 검사를 실행한다

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
QA_DIR="$PROJECT_DIR/.qa"
SESSION_FILE="$QA_DIR/current-session.log"
REPORT_FILE="$QA_DIR/qa-report-$(date '+%Y%m%d-%H%M%S').md"

echo "=== 자동 품질 검사 시작 ==="

# 1. 수정된 파일 목록 확인
if [ ! -f "$SESSION_FILE" ] || [ ! -s "$SESSION_FILE" ]; then
  echo "수정된 파일이 없습니다. 검사를 건너뜁니다."
  exit 0
fi

CHANGED_FILES=$(sort -u "$SESSION_FILE")
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)

echo "검사 대상: ${FILE_COUNT}개 파일"
echo ""

# 2. 검사 결과 수집
ERRORS=0
WARNINGS=0

# TypeScript/JavaScript lint 검사 (프로젝트에 eslint가 있을 경우)
if command -v npx &> /dev/null && [ -f "$PROJECT_DIR/package.json" ]; then
  echo "--- ESLint 검사 ---"
  while IFS= read -r file; do
    if [[ "$file" == *.ts ]] || [[ "$file" == *.tsx ]] || [[ "$file" == *.js ]] || [[ "$file" == *.jsx ]]; then
      RESULT=$(npx eslint "$file" 2>&1)
      if [ $? -ne 0 ]; then
        echo "[ERROR] $file"
        echo "$RESULT"
        ((ERRORS++))
      fi
    fi
  done <<< "$CHANGED_FILES"

  # TypeScript 타입 체크
  if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
    echo "--- TypeScript 타입 검사 ---"
    TS_RESULT=$(npx tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
      echo "[ERROR] 타입 오류 발견"
      echo "$TS_RESULT"
      ((ERRORS++))
    fi
  fi
fi

# 3. 보안 패턴 검사
echo ""
echo "--- 보안 패턴 검사 ---"
while IFS= read -r file; do
  if [ -f "$file" ]; then
    # 하드코딩된 비밀키/비밀번호 검사
    if grep -inE "(password|secret|api_key|apikey|token)\s*[:=]\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null; then
      echo "[SECURITY] 하드코딩 의심: $file"
      ((WARNINGS++))
    fi
    # console.log 검사
    if grep -n "console\.log" "$file" 2>/dev/null; then
      echo "[WARNING] console.log 발견: $file"
      ((WARNINGS++))
    fi
  fi
done <<< "$CHANGED_FILES"

# 4. 결과 요약
echo ""
echo "=== 검사 결과 요약 ==="
echo "검사 파일: ${FILE_COUNT}개"
echo "에러: ${ERRORS}개"
echo "경고: ${WARNINGS}개"

if [ $ERRORS -gt 5 ]; then
  echo ""
  echo "[추천] 에러가 많습니다. 전문 QA 에이전트(docs/agents/qa-agent.md)를 호출하세요."
elif [ $ERRORS -gt 0 ]; then
  echo ""
  echo "[추천] 에러를 즉시 수정하세요."
else
  echo ""
  echo "[OK] 자동 검사 통과!"
fi

echo "==========================="

# 5. 보고서 저장
mkdir -p "$QA_DIR"
cat > "$REPORT_FILE" << REPORT
# QA 검사 보고서
- 검사일시: $(date '+%Y-%m-%d %H:%M:%S')
- 검사 파일 수: ${FILE_COUNT}
- 에러: ${ERRORS}
- 경고: ${WARNINGS}

## 검사 대상 파일
$(echo "$CHANGED_FILES" | sed 's/^/- /')

## 결과
$([ $ERRORS -eq 0 ] && echo "모든 자동 검사 통과" || echo "에러 ${ERRORS}건 발견 - 수정 필요")
REPORT

echo "보고서 저장: $REPORT_FILE"
