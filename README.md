# Project Espera

Project Espera는 특정 AI 회사나 모델에 종속되지 않는 개인용 지속형 AI workspace입니다.

사용자가 OpenAI, Claude, Gemini, OpenRouter, LM Studio, vLLM 등 서로 다른 모델을 사용하더라도 Espera가 관리하는 다음 맥락은 계속 유지됩니다.

- 대화 기록
- Persona와 응답 선호
- 사용자가 승인한 장기 Memory
- 프로젝트별 작업 맥락
- Provider와 모델 연결 정보

## 핵심 원칙

LLM은 교체 가능한 추론 엔진이고, 사용자 맥락은 Espera가 소유합니다. 모델을 바꾸면 답변의 문체와 추론은 달라질 수 있지만, 사용자가 승인한 Memory와 Persona는 유지됩니다.

Memory는 자동으로 즉시 확정되지 않습니다.

```text
대화 → Memory 후보 → 사용자 검토 → 승인 → 장기 Memory
```

## 주요 기능

- GitHub OAuth 기반 멀티유저 로그인
- 사용자별 Conversation, Memory, Persona, Project 격리
- ChatGPT 스타일의 채팅 workspace
- 한국어/English 언어 전환
- Mock, OpenAI, Anthropic, Gemini, OpenAI-compatible Provider
- Provider별 모델 목록 조회와 수동 모델 ID
- 사용자가 직접 입력하는 API Key(BYOK)
- API Key의 탭 메모리 보관 정책
- Pending / Active / Rejected / Superseded / Deleted Memory
- Memory evidence와 revision history
- Persona 버전과 변경 이력
- Project-scoped context
- Context Inspector
- Cloudflare Workers + D1 배포

## 기술 스택

- Frontend: React, TypeScript, Vite, Tailwind CSS
- API: Cloudflare Workers, Hono
- Database: Cloudflare D1(SQLite)
- Authentication: GitHub OAuth, HttpOnly Secure session cookie
- Test: Vitest, Playwright
- Deployment: Wrangler, Cloudflare Pages

## 로컬 실행

필요 조건: Node.js 20 이상, npm 10 이상

```bash
npm ci
npm run db:migrate:local
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

Mock Provider는 외부 API Key 없이 사용할 수 있습니다.

## 테스트와 빌드

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e
```

실제 Provider smoke test는 기본 실행하지 않습니다. 명시적으로 환경변수를 설정한 경우에만 실행해야 합니다.

## Provider와 API Key

Settings에서 Provider, 연결 이름, Base URL, API Key를 입력합니다. API Key는 D1, Web Storage, URL, 로그, Context Inspector에 저장하지 않으며 현재 브라우저 탭에서만 사용합니다.

새로고침하면 연결 metadata는 유지되지만 API Key는 다시 입력해야 합니다.

## 로그인 설정

GitHub OAuth App callback URL:

```text
https://project-espera-api.hfainvididual.workers.dev/api/auth/github/callback
```

Cloudflare secret:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

실제 secret은 소스코드나 문서에 기록하지 않습니다.

## 배포

```bash
cd packages/server
npx wrangler d1 migrations apply project-espera-db --remote
npx wrangler deploy
```

```powershell
$env:VITE_API_BASE_URL="https://project-espera-api.hfainvididual.workers.dev"
npm run build
npx wrangler pages deploy packages/client/dist --project-name project-espera-web
```

현재 production:

- Frontend: https://project-espera-web.pages.dev
- API: https://project-espera-api.hfainvididual.workers.dev
- Worker: `project-espera-api`
- D1: `project-espera-db`

## 문서

제품 의도, 도메인 모델, 인증, Context Engine, Memory Engine, 보안과 배포 구조는 [project.md](./project.md)를 참고하세요.

상세 아키텍처는 [ARCHITECTURE.md](./ARCHITECTURE.md), 보안 분석은 [THREAT_MODEL.md](./THREAT_MODEL.md)에 정리되어 있습니다.

## 알려진 제한

- OAuth 로그인은 현재 GitHub provider만 지원합니다.
- API Key는 새로고침 후 재입력이 필요합니다.
- Memory 검색은 현재 D1 키워드 검색 중심입니다.
- 실제 Provider live test는 별도 API Key와 비용이 발생할 수 있으므로 opt-in입니다.
