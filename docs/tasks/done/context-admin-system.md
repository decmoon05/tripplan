# 맥락 노트: 관리자 시스템

## 배경
- 개발자 본인이 AI_DAILY_LIMIT(10회)에 막혀 테스트 불가
- 역할(role) 개념 없어 모든 유저 동일 제한

## 핵심 결정
- role: 'user' | 'developer' | 'admin' (DB text + CHECK)
- 기존 SELECT 정책 DROP 후 admin 조건 포함으로 교체
- auth.users 이메일 조회: service role key 필요
- admin role 체크는 API 레벨 (미들웨어는 로그인만)

## 주의사항
- 기존 "Users can view own profile" 정책과 admin 정책 충돌 → DROP 후 교체
- api_usage_log "Users can view own usage" 정책도 동일
