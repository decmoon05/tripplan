# 게이트웨이 504 타임아웃 수정 계획서

> 작성일: 2026-03-18
> 상태: 완료
> 관련 체크리스트: `./checklist-gateway-timeout-fix.md`
> 관련 맥락 노트: `./context-gateway-timeout-fix.md`

## 1. 목표

- mindlogic.ai 게이트웨이의 Cloudflare 60초 타임아웃으로 인한 일정 생성 504 오류 해결
- AI 일정 생성이 mock 폴백 없이 실제 AI 응답으로 완료되도록 함

## 2. 범위

### 포함
- 게이트웨이 모드 다일 여행 분할 요청
- 프롬프트 압축 (1일 단위)
- Claude provider max_tokens 조정

### 제외
- 게이트웨이 자체 타임아웃 설정 변경 (통제 불가)
- 직접 API 모드 동작 변경 (기존 유지)

## 3. 기술 결정

| 항목 | 선택 | 이유 |
|------|------|------|
| 타임아웃 해결 방식 | 하루씩 분할 요청 | 프롬프트 축소만으로는 reasoning 모델의 token 소비를 통제 불가. 분할이 가장 확실 |
| 프롬프트 압축 | 1일 전용 압축 프롬프트 | 전체 프롬프트 대비 ~60% 축소, 이전 날 장소 전달로 중복 방지 |
| 적용 범위 | 게이트웨이 모드만 | 직접 API는 120초 timeout으로 충분 |

## 4. 파일 구조 (수정)

```
src/lib/services/ai/
├── 수정: prompt.ts — buildSingleDayUserPrompt() 추가
├── 수정: openai.provider.ts — 분할 요청 로직 + callOpenAI 공통화
└── 수정: claude.provider.ts — max_tokens 4000→8000
```

## 5. 단계별 작업

1. [x] prompt.ts에 buildSingleDayUserPrompt() 추가
2. [x] openai.provider.ts에 분할 요청 로직 구현
3. [x] claude.provider.ts max_tokens 증가
4. [x] tsc + next build 통과 확인

## 6. 의존성 및 선행 조건

- 기존 isGatewayMode() 함수 (이미 구현됨)
- getDayCount 유틸 (이미 존재)

## 7. 검증 기준

- `tsc --noEmit` 통과
- `next build` 통과
- 게이트웨이 모드에서 3일 여행 생성 시 504 없이 완료
- 직접 API 모드에서 기존 동작 유지
