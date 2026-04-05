# 맥락 노트 — AI 프로바이더 전환

## 핵심 결정
- Reasoning 모델(gpt-5.4-mini)이 게이트웨이 100초 타임아웃 + 토큰 낭비 → Claude Sonnet(non-reasoning)으로 전환
- 경량 쿼리는 GPT-5.4 nano (non-reasoning, 빠름)
- Claude 내부에 3-layer 폴백 (streaming → non-streaming → nano), ai.service에서 크로스 프로바이더 폴백

## 주의사항
- Claude API는 system이 top-level param → 게이트웨이 "system role 금지" 미적용
- ANTHROPIC_BASE_URL 게이트웨이는 스트리밍 미지원 가능 → 비스트리밍 자동 폴백
- nano는 non-reasoning → isReasoningModel()에서 false 반환 필요
