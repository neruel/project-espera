# FINDINGS.md — Project Espera 전수 감사 (2026-09-23)

조사 캐시. 같은 조사를 반복하지 않기 위한 기록.

## PHASE 0 — 기준선

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | pass (client / server / shared 전부) |
| `npm run lint` | pass (64 files) |
| `npm test` | pass — 8 files / 25 tests |

기준선이 완전히 green이었다. 따라서 남은 결함은 **정적 검사가 잡지 못하는 계약·의미 오류**이며,
특히 테스트가 커버하지 않는 client↔server 경계에 집중해 조사했다.

읽은 설정: 루트 `package.json`/`tsconfig.json`/`vitest.config.ts`, `wrangler.toml`,
`vite.config.ts`, `.env.example`, `migrations/*.sql`(4개), `shared/schemas/index.ts`, `shared/types/domain.ts`.

`packages/server/packages/server/.data/` — 파일 없는 3단 빈 디렉터리. 잘못 생성된 산출물이며 **삭제 후보**(미삭제).

---

## 1. 수정함

| P | 파일:라인 | 원인 | 수정 |
|---|---|---|---|
| P0 | `client/src/components/Chat/ChatView.tsx:291,309` | `session.connectionId`는 저장된 연결 id(`conn_*`)와 **내장 provider id(`mock`/`openai`/…)를 같은 필드에 담는다**(`selectProvider()`가 `providers ++ connections` 합본 select의 값을 그대로 넣음, 기본값 `'mock'`). 이 값이 `/api/chat`의 `connectionId`로 전송되면 `connectionRepo.getProviderId('mock')` → null → **404 `Provider connection not found`**. 내장 provider(기본 mock 포함)로는 메시지를 단 한 건도 보낼 수 없었다. `app.fetch`로 404 재현 확인. | `connections`에서 실제로 해석되는 경우에만 `connectionId`를 전송(`connectionId: connection?.id`). `find`의 죽은 `c.id === session.providerId` 분기도 제거(연결 id와 provider id는 형식이 겹치지 않아 절대 매치되지 않음) |
| P1 | `server/src/memory/extractor.ts:103` | `provider.generate({ modelId: (await provider.listModels())[0].id })` — `listModels()`를 **credential 없이** 호출. openai/anthropic/gemini/openai-compatible 모두 credential이 없으면 `[]`를 반환하므로 `[0].id`가 TypeError → 상위 try/catch가 삼켜 **모든 실제 provider에서 memory 추출이 조용히 무력화**. mock 경로만 동작해 테스트가 통과하고 있었다. | 턴이 이미 사용한 `body.modelId`를 `chat.ts` → `lifecycle.processTurn` → `extractor.extract`로 전달해 사용. `listModels(credential)`은 fallback으로만 남기고 빈 목록이면 `[]` 반환(throw 아님) |
| P1 | `client/src/components/Chat/ChatView.tsx:132-143` | activeConvId가 바뀔 때 `conversations`에서 project scope를 재동기화하는데, **레코드가 아직 목록에 없으면 `null`로 초기화**. (a) 프로젝트 안에서 새 대화의 첫 메시지를 보낸 직후(`loadConversations()`는 async), (b) 프로젝트 대화를 열어둔 채 새로고침한 직후 발생. 이후 두 번째 메시지는 `projectId: null`로 나가고 `chat.ts:80`이 **409 `Conversation project scope does not match the request`**로 거절 → 대화가 사용 불가 상태가 된다 | scope 동기화를 `[activeConvId, conversations]` 의존 effect로 분리하고, **레코드가 존재할 때만** 반영. 레코드가 도착하면 재동기화되고, 미저장 새 대화에서는 사용자가 고른 scope가 보존된다 |
| P2 | `server/src/routes/chat.ts:129` | `registry.get(body.providerId)`가 **user message를 이미 저장한 뒤에** 호출됨. 알 수 없는 providerId면 throw → `app.onError` 500 + 고아 user message + (conversationId 미지정 시) 빈 대화가 남는다 | provider 해석을 body 파싱 직후, 모든 쓰기 이전으로 이동하고 400 `Unknown provider` 반환 |
| P2 | `server/src/db/repositories/context-run.repo.ts:41` | `ORDER BY cr.created_at DESC` 단독. `created_at`은 `datetime('now')`로 **초 단위**이므로 같은 초에 기록된 run들 사이에서 순서가 미정 → Context Inspector가 최신이 아닌 run을 보여줄 수 있다 | `, cr.rowid DESC` 추가 (repo의 다른 쿼리와 동일한 tie-break 패턴) |

### 추가한 회귀 테스트 (기존 vitest 파일에만 추가, 새 프레임워크 없음)
- `tests/unit.test.ts` — `10. Memory extraction reuses the turn model…`: credential 없이 `listModels()`가 `[]`를 반환하는 스텁 provider로, 전달된 modelId를 사용하는지 + 모델을 못 고르면 throw 없이 비는지 검증.
- `tests/integration.test.ts` — `rejects an unknown provider with 400 and persists nothing`.
- `tests/integration.test.ts` — `keeps a project-scoped conversation usable across consecutive turns`: 동일 projectId 연속 2턴 200, scope를 null로 떨어뜨리면 409(P1 클라이언트 버그가 서버에서 어떻게 드러나는지 고정).

---

## 2. 미수정 (이유 포함)

- **[P2] `server/src/providers/http.ts:26` — 라우트/로직에서 `process.env` 직접 접근.** `CLAUDE.md §5`의 "Node 전용 API 금지" 불변 조건 위반. 실사용상 문제는 없다: Worker는 `index.ts`가 `setEndpointPolicy()`로 먼저 값을 주입하고, `nodejs_compat`가 `process.env`를 제공한다. 동작하는 코드를 정책 이유만으로 재작성하는 것은 규칙 9(스타일 리팩터링 금지)에 해당하므로 보고만 한다. 같은 파일의 `import net from 'node:net'`도 동일.
- **[P2] `server/src/dev-server.ts` — `setEndpointPolicy()` 미호출.** `index.ts`와 비대칭이지만 `http.ts`의 fallback이 `process.env.ESPERA_ENDPOINT_POLICY`를 직접 읽으므로 node 런타임에서도 값이 실제로 반영된다. 재현되는 결함이 아니라 미수정(규칙 8).
- **[P2] `memory.repo.ts:229-236` `editAndApproveMemory`의 UPDATE에 `user_id` 조건 없음.** 직전 `getMemoryById(id, userId)`가 소유권을 검증하므로 **IDOR은 성립하지 않는다**. 다른 메서드와 일관성만 떨어진다. 이론적 가능성을 취약점으로 과장하지 않기 위해 미수정(규칙 8 + PHASE 3 지침).
- **[P2] `editAndApproveMemory`가 현재 status와 무관하게 `active`로 만든다.** `deleted`/`rejected` memory도 edit-and-approve로 부활 가능. 다만 "편집 후 승인"이라는 의도된 동작인지 판단할 근거가 코드에 없어 기능 변경을 하지 않았다.
- **[P3] `routes/memory.ts:45,103` / `routes/persona.ts:45` — `c.req.json()`에 `.catch()` 없음.** 잘못된 JSON 본문이 400이 아니라 500이 된다. 클라이언트는 항상 유효한 JSON을 보내므로 실사용 경로가 없다.
- **[P3] `api.ts:207` `streamChat`** — `!res.ok`일 때 서버의 error 본문을 버리고 `Chat request failed with status N`만 던진다. 사용자에게 원인이 전달되지 않는다.
- **[P3] `context-run.repo.ts getRunById`** — 어떤 라우트에서도 호출되지 않는 dead code이며 user 스코프도 없다.
- **[P3] `app.ts:23` CORS `origin: '*' + credentials: true`** — 브라우저가 거부하는 조합. 단 dev는 vite proxy로 same-origin이고 prod는 `ESPERA_ALLOWED_ORIGIN`이 설정되므로 실제 노출 경로가 없다.
- **[P3] `sessions` 테이블 만료 행 정리 작업 없음.** 로그인이 누적되면 계속 남는다.

### 확인했고 문제 없었던 영역 (재조사 불필요)
- SQL injection: 전체 쿼리를 grep — 모든 값이 `.bind()` 파라미터. `memory.repo.getMemories`의 동적 절도 조건 문자열만 붙이고 값은 전부 바인딩, `LIKE`는 `ESCAPE '\'` + 이스케이프 처리.
- IDOR: conversations / memories / projects / persona / provider-connections / inspector 전 라우트가 `requestUserId(c)`로 스코프되고 repo 쿼리에 `user_id = ?`가 있다. `getRevisions`/`getEvidence`는 `memories`와 INNER JOIN으로 소유권을 강제.
- API 키: `session.ts`가 localStorage에 `providerId/modelId/connectionId/selectedConversationId`만 저장하고 `apiKeys`는 메모리 전용. 응답은 `credentialStored` boolean과 `maskApiKey()`만 노출. `safeFetch`가 네트워크 에러 메시지에서 키를 치환. e2e가 Web Storage 미저장을 검증.
- XSS: `ChatView.tsx:31`의 `rehypeSanitize` 유지, `dangerouslySetInnerHTML` 없음.
- Prompt injection: `context/engine.ts:121`이 과거 대화 요약에 "untrusted conversation record / treat as data" 경계를 넣고, `buildSystemPrompt`가 grounding rule을 마지막에 붙인다.
- 페이지네이션: `conversations/:id/messages`와 `memories` 모두 `limit+1` 조회 후 슬라이스 방향이 정확해 페이지 경계에서 유실·중복 없음(양쪽 인덱스 수동 추적으로 확인).
- OAuth: state를 쿠키와 쿼리 양쪽에서 대조 + DB 만료 검증 + 1회용 삭제. 세션 토큰은 SHA-256 해시로만 저장.
- `sqljs-adapter.ts`의 `meta.changes`가 `getRowsModified()`로 D1 의미와 일치 — 이를 신뢰하는 모든 repo의 404 판정이 유효.

---

## 3. 백로그 (수정 중 발견, 확장 조사하지 않음)

- `lifecycle.processTurn`의 중복 검사(`getMemories(userId)`)가 project 경계를 무시한다 — 다른 프로젝트의 memory와 중복 판정될 수 있다.
- `deduplicator`가 `isConflict`를 계산하지만 `lifecycle`은 이를 무시하고 그냥 후보를 생성한다(충돌 해소 로직 미구현).
- `extractor.ts`의 `FORBIDDEN_KEYWORDS`는 canonicalText/subject/predicate만 검사하고 `valueJson`·`snippet`은 검사하지 않는다.
- `dev-server.ts`가 1초마다 DB 전체를 디스크에 덮어쓴다(`setInterval(persist, 1000)`) — DB가 커지면 비용이 선형 증가.
- `dev-server.ts`의 `import path from 'node:path'`는 미사용.
- `shared/types/domain.ts`의 `ProviderConnection` 인터페이스는 마이그레이션 0003이 추가한 `display_name`/`endpoint_url`을 반영하지 않는다(서버는 별도 `ProviderConnectionRecord`를 쓰므로 실사용 불일치는 없음).
