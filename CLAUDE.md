# CLAUDE.md — Project Espera

이 파일은 Claude Code가 매 세션 시작 시 repo를 재탐색하지 않도록 하는 **영구 컨텍스트**다.
사실이 아닌 내용을 발견하면 이 파일을 먼저 수정하고 작업을 계속한다.

## 1. 개요
- 개인용 AI 채팅/메모리 서비스. npm workspaces 모노레포.
- 전체 소스 규모: TS/TSX/MJS 약 **8,750 LOC / 66 파일**. (전량 읽기는 가능하지만 비효율 — critical path 우선)

## 2. 디렉터리 맵 (분석 대상)
```
packages/shared/src/        # 계약의 단일 출처
  types/domain.ts (224)     # 도메인 타입
  schemas/index.ts (134)    # zod 스키마 (API 계약)
  index.ts
packages/server/src/
  index.ts                  # Cloudflare Worker entry
  dev-server.ts             # 로컬 node entry (@hono/node-server)
  app.ts                    # Hono 앱 / 미들웨어 / 라우트 마운트
  routes/                   # auth, chat(228), conversations, inspector, memory(164), persona, projects, providers
  auth/service.ts (143)
  security/crypto.ts (90)   # API 키 암호화
  context/engine.ts (227)   # 프롬프트/컨텍스트 조립 (Persona+Memory+Project)
  memory/                   # extractor(137), deduplicator, lifecycle
  providers/                # registry, types, http, openai/anthropic/gemini/mock provider
  db/
    d1-interface.ts         # D1 추상화
    sqljs-adapter.ts, local-db.ts, local-db-cli.ts   # 로컬 sql.js
    repositories/           # user, conversation, memory(354), persona, project, provider-connection, context-run
  test-utils/test-db.ts
  tests/                    # vitest: unit(377), integration(237), auth, projects, memory-search,
                            #         provider-connections, provider-persistence, gemini-streaming
packages/server/migrations/ # 0001_initial_schema, 0002_provider_connection_catalog,
                            # 0003_provider_connection_metadata, 0004_auth_sessions
packages/server/wrangler.toml
packages/client/src/
  main.tsx, App.tsx (202), i18n.tsx, index.css
  services/api.ts (461)     # 모든 서버 호출의 단일 지점
  stores/session.ts
  components/ Chat/ChatView.tsx (890), Memory/MemoryManager.tsx (637),
              Settings/SettingsView.tsx (628), Projects/ProjectsView.tsx (443),
              Persona/PersonaEditor.tsx (439), Navbar.tsx (263),
              Inspector/ContextInspectorModal.tsx (193), Auth/LoginView.tsx,
              Account/AccountMenu.tsx, Common/{ConfirmDialog,useDialogAccessibility}
packages/client/{vite.config.ts,tailwind.config.js,postcss.config.js,index.html,tsconfig.json}
e2e/core.spec.ts + playwright.config.ts
scripts/{lint.mjs, production-smoke.mjs, live-provider-smoke.mjs}
루트: package.json, tsconfig.json, vitest.config.ts, .env.example
문서: ARCHITECTURE.md, CURRENT_STATE.md, DEPLOYMENT.md, THREAT_MODEL.md, TODO.md, project.md, implementation_plan.md, README.md
```

## 3. 절대 읽지 말 것 (토큰 낭비 / 소스와 중복)
```
**/node_modules/**
packages/client/dist/**
packages/server/dist/**
packages/shared/dist/**
packages/server/packages/**      # 빈 중첩 디렉터리 — 잘못 생성된 산출물, 삭제 후보
.wrangler/**  packages/server/.wrangler/**
packages/server/.data/**  **/*.sqlite*
**/*.map  **/*.tsbuildinfo
package-lock.json
test-results/**  playwright-report/**  coverage/**
```
문서 파일은 **필요할 때 1회만** 읽는다: 아키텍처 의문 → `ARCHITECTURE.md`, 보안 → `THREAT_MODEL.md`,
배포/환경변수 → `DEPLOYMENT.md` + `.env.example`, 현황/기지 이슈 → `CURRENT_STATE.md` + `TODO.md`.

## 4. 실제 존재하는 명령 (이것만 사용)
```
npm run build        # shared → server → client 순차 빌드
npm run typecheck    # 워크스페이스 전체 tsc --noEmit
npm run lint         # node scripts/lint.mjs (커스텀 린터, eslint 아님)
npm test             # vitest run
npm run test:e2e     # playwright (서버/클라 기동 필요)
npm run dev          # server+client 동시
npm run db:migrate:local / db:reset:local
npm run test:production / test:live   # 네트워크·실제 키 필요 → 요청 없으면 실행 금지
```

## 5. 불변 조건 (수정 시 반드시 지킬 것)
- API 계약의 출처는 `packages/shared/src/schemas/index.ts` + `types/domain.ts` 하나뿐이다.
  route와 `client/src/services/api.ts`는 여기서 파생된다. 계약 변경 시 **3곳을 함께** 고친다.
- DB 스키마 변경은 `migrations/`에 **새 파일 추가**로만 한다. 기존 마이그레이션 파일은 수정하지 않는다.
- 서버는 Worker와 node 두 런타임에서 모두 동작해야 한다(`index.ts` / `dev-server.ts`).
  Node 전용 API(fs, crypto 모듈, process.env 직접 접근)를 라우트/로직에 도입하지 않는다.
- 프로바이더 API 키는 `security/crypto.ts`를 통해서만 저장/복호화하며 응답·로그에 평문으로 나가지 않는다.
- 마크다운 렌더링의 `rehype-sanitize`는 제거하거나 우회하지 않는다.
- 새 의존성 추가 금지(정당한 이유가 없으면). 기존 패턴/라이브러리를 먼저 쓴다.

## 6. 작업 로그
`FINDINGS.md`에 "수정함 / 미수정(이유) / 권장" 3구획을 유지한다. 같은 조사를 반복하지 않기 위한 캐시다.
