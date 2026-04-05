/**
 * Gemini API 클라이언트 싱글턴 + 키 로테이션.
 *
 * 모든 Gemini 호출 (v2 provider, v3 adapter, audit)이 공유.
 * 한 쪽에서 429로 rotate하면 다른 쪽도 즉시 반영.
 */

import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// 키 파싱 (GEMINI_API_KEYS 콤마 구분 또는 GEMINI_API_KEY 단일)
// ---------------------------------------------------------------------------

function getApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return raw.split(',').map(k => k.trim()).filter(k => k.length > 10);
}

// ---------------------------------------------------------------------------
// 싱글턴 상태 — 모듈 스코프 (모든 import가 동일 인스턴스 공유)
// ---------------------------------------------------------------------------

let _clients: GoogleGenAI[] = [];
let _currentKeyIndex = 0;
let _initialized = false;

function init(): void {
  if (_initialized) return;
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY 또는 GEMINI_API_KEYS 환경변수가 설정되지 않았습니다');
  _clients = keys.map(apiKey => new GoogleGenAI({ apiKey }));
  _currentKeyIndex = 0;
  _initialized = true;
  if (keys.length > 1) {
    console.log(`[Gemini] 멀티 키 로테이션 활성화: ${keys.length}개 키`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** 현재 키에 대응하는 Gemini 클라이언트 반환. 캐싱됨. */
export function getGeminiClient(): GoogleGenAI {
  init();
  return _clients[_currentKeyIndex];
}

/** 429 발생 시 다음 키로 전환. 전부 소진이면 false. */
export function rotateGeminiKey(): boolean {
  init();
  if (_clients.length <= 1) return false;
  const prevIndex = _currentKeyIndex;
  _currentKeyIndex = (_currentKeyIndex + 1) % _clients.length;
  console.log(`[Gemini] 🔄 키 로테이션: ${prevIndex + 1}/${_clients.length} → ${_currentKeyIndex + 1}/${_clients.length}`);
  return true;
}

/** 키 개수 반환 (maxRetries 결정용) */
export function getGeminiKeyCount(): number {
  return getApiKeys().length;
}
