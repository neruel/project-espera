# Project Espera Implementation Plan

## 현재 상태 — Phase 1.5

완료:

- Provider-independent domain/context/memory 구조
- Mock/OpenAI/Anthropic/Gemini/OpenAI-compatible adapters
- 사용자 지정 Base URL 및 API Key 입력
- 실제 모델 목록 조회와 수동 Model ID fallback
- Connection별 모델 선택 및 실제 채팅 요청
- API Key의 Web Storage/D1 비저장
- OpenAI-compatible URL 정규화 및 redirect 차단
- Memory Inbox, Persona, Conversation, Context Inspector 유지
- 14개 테스트, 전체 TypeScript typecheck, production build 통과

## 다음 단계

1. Wrangler local D1 기반 개발 데이터 영속화
2. 운영 SSRF 보호: DNS/IP 확인 및 private/link-local/metadata network 차단
3. Gemini native delta streaming
4. Provider connection metadata의 D1 저장과 Key 재입력 UX
5. 실제 사용자 Key를 이용한 opt-in smoke test
6. PWA, Vectorize, Ollama native adapter는 이후 진행

## 의도적으로 제외한 범위

- 멀티유저 인증
- API Key 영구 저장 및 기기 간 동기화
- Vector DB
- 파일/이미지 입력
- 네이티브 Ollama API
