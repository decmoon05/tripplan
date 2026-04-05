# _legacy — v1~v3 AI 파이프라인 스냅샷

이 디렉토리는 v4 재설계 전의 AI 파이프라인 코드를 보존합니다.

- **수정 금지** — 실험/비교용으로만 사용
- **원본 위치**: `src/lib/services/ai/` (기존 route들이 여전히 import)
- **v4 코드**: `src/lib/services/planner/` (새 파이프라인)
- **스냅샷 일자**: 2026-04-04
- **포함 내용**: v2 레거시 + v3 하이브리드 파이프라인 전체

v4가 안정화되면 `src/lib/services/ai/`의 원본을 이 디렉토리로 완전 이동하고,
기존 route들의 import를 v4 planner로 교체합니다.
