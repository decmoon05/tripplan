# Tripplan

AI 기반 맞춤 여행 계획 서비스

## 기술 스택

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion
- **Backend**: Next.js API Routes, Supabase (Auth + DB + Storage + Realtime)
- **AI**: Gemini 2.5 Pro/Flash + Claude + OpenAI (fallback chain), 스트리밍 지원
- **Infra**: Vercel, Supabase Hosted

## 주요 기능

- AI 기반 여행 일정 자동 생성 (12단계 파이프라인)
- Google Places RAG 연동 (할루시네이션 방지)
- Travel Room (그룹 여행 실시간 동기화, 투표, 채팅)
- 실시간 날씨/환율 정보
- 준비물 체크리스트, 예산 관리, 사진 갤러리
- PWA 오프라인 지원
- ICS 캘린더 / PDF 내보내기

---

> **Copyright (c) 2026 김영석. All Rights Reserved.**
> 본 저장소는 채용/지원 심사를 위한 포트폴리오 열람 목적으로만 공개됩니다.
> 무단 복제, 수정, 배포 및 상업적 이용을 금지합니다.
