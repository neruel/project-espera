# Claude Code Master Prompt — Project Espera 전수 감사 및 수정

아래 전체를 Claude Code(Opus 5) 첫 메시지로 붙여넣는다. repo 루트에 `CLAUDE.md`를 먼저 배치할 것.

---

너는 이 repo(Project Espera, npm workspaces 모노레포)의 **실행 가능한 결함을 찾아 직접 수정**한다.
코드 리뷰 에세이를 쓰는 것이 아니다. 설명은 최소화하고 조사·수정·검증을 수행한다.

## 규칙 (위반 금지)
1. `CLAUDE.md`를 먼저 읽는다. 여기에 디렉터리 맵, 제외 목록, 실제 npm 스크립트, 불변 조건이 있다. **repo를 스스로 전역 탐색하지 말고 이 맵을 신뢰**한다. 맵이 틀린 부분만 확인하고 `CLAUDE.md`를 고친다.
2. `CLAUDE.md` §3의 제외 경로는 **절대 읽지 않는다**(node_modules, 모든 dist, .wrangler, .data/*.sqlite, *.map, package-lock.json, test-results). generated output은 소스와 중복이다.
3. 이미 읽은 파일은 다시 읽지 않는다. 필요하면 메모리 대신 `FINDINGS.md`를 참조한다.
4. 300줄 초과 파일은 전체 읽기 전에 `grep`으로 관련 심볼 위치를 먼저 찾고 해당 범위만 읽는다.
   대상: `ChatView.tsx(890)`, `MemoryManager.tsx(637)`, `SettingsView.tsx(628)`, `api.ts(461)`, `ProjectsView.tsx(443)`, `PersonaEditor.tsx(439)`, `memory.repo.ts(354)`, `unit.test.ts(377)`.
5. 한 문제를 조사할 때 여는 파일은 최소 집합으로 제한한다. 문제가 없는 영역은 더 파지 않는다.
6. 같은 내용을 두 번 요약하지 않는다. 중간 진행 설명은 한 줄 이내.
7. `CLAUDE.md` §4에 없는 명령은 실행하지 않는다. `test:live` / `test:production`은 실제 API 키·네트워크가 필요하므로 **실행 금지**.
8. **추측은 수정하지 않는다.** 코드 경로로 재현 가능하거나 명확한 근거가 있을 때만 코드를 바꾼다. 나머지는 보고만 한다.
9. 기존 아키텍처·의도·UX·기능을 보존한다. 스타일 취향 리팩터링 금지, 동작하는 코드 재작성 금지, 대규모 구조 변경은 P0/P1 버그 해결에 불가피한 경우만.
10. 새 의존성 추가 금지. 기존 라이브러리와 패턴을 쓴다.
11. 수정 중 발견한 **독립적인** 새 문제는 확장 조사하지 말고 `FINDINGS.md`의 백로그에 한 줄로 적고 현재 작업을 계속한다. 현재 문제 해결에 **직접 필요한** 것만 즉시 처리한다.

## PHASE 0 — 기준선 (읽기 최소, 실행 우선)
파일을 읽기 전에 신호를 먼저 수집한다:
```
npm run typecheck
npm run lint
npm test
```
출력(에러/실패 목록)을 `FINDINGS.md`에 기록한다. 이것이 가장 저렴한 버그 탐지기다.
설치가 필요하면 `npm ci`(실패 시 `npm install`) 1회만.
그 다음 확인: 루트 `package.json`·`tsconfig.json`·`vitest.config.ts`, `packages/server/wrangler.toml`,
`packages/client/vite.config.ts`, `.env.example`, `migrations/*.sql`(4개), `shared/src/schemas/index.ts`, `shared/src/types/domain.ts`.
`packages/server/packages/` 가 비어 있는 잘못된 산출물인지 확인하고, 그렇다면 삭제 후보로 보고한다.

## PHASE 1 — Critical path 추적
다음 경로를 **끝에서 끝까지 한 번** 따라가며 계약 불일치를 찾는다:
사용자 입력 → `ChatView.tsx` → `services/api.ts` → `app.ts` 미들웨어 → `routes/chat.ts` → `context/engine.ts` → `providers/registry.ts` + 해당 provider → `db/repositories/*` → `d1-interface.ts` → 응답 → client state.
그 후 아래 흐름을 각각 독립적으로 추적한다(각 흐름당 route + repo + 해당 UI 1개 + 관련 스키마만 읽는다):
- auth: `routes/auth.ts` ↔ `auth/service.ts` ↔ `user.repo.ts` ↔ `0004_auth_sessions.sql` ↔ `stores/session.ts` / `LoginView.tsx`
- memory: `routes/memory.ts` ↔ `memory/{extractor,deduplicator,lifecycle}` ↔ `memory.repo.ts` ↔ `MemoryManager.tsx`
- persona / projects / providers(키 저장·복호화) / inspector 각각 동일 방식
검증 포인트: 요청·응답 타입이 zod 스키마와 실제로 일치하는가, repo의 SQL 컬럼이 migrations와 일치하는가,
route에 인증·소유권 검사가 있는가.

## PHASE 2 — 정적 결함 감사
타입 오류/우회(`as any`, non-null `!`), null·undefined 가정, API request/response mismatch, DB schema mismatch,
await 누락·floating promise, 순차 처리로 인한 경합, stale state·useEffect 의존성 오류, 낙관적 업데이트 롤백 누락,
try/catch 삼킴·에러 응답 형식 불일치, 환경변수 오용(Worker에서 `process.env` 등), 데이터 유실 가능성(트랜잭션 없는 다단 쓰기),
Persona/Memory/RAG 조립 로직 오류(컨텍스트 토큰 초과, 중복 삽입, 관련성 정렬 오류), 실제 버그를 가리는 dead code.
grep으로 후보를 모은 뒤 해당 범위만 확인한다.

## PHASE 3 — 보안 감사
API 키 노출(응답/로그/클라이언트 번들), server↔client 경계 위반, 인증 우회, authorization 누락, **IDOR(userId 스코프 누락 쿼리)**,
prompt injection(사용자 메모리/프로젝트 텍스트가 시스템 프롬프트에 들어가는 경로), SQL injection(문자열 결합 쿼리),
XSS·unsafe HTML(마크다운 렌더 경로), CORS 설정, 민감정보 로깅, 외부 API 응답 미검증, 파일 업로드, rate limiting,
secret 처리. 필요하면 `THREAT_MODEL.md`를 1회 읽는다.
**실제 악용 경로가 없는 이론적 가능성은 취약점으로 과장하지 않는다.**

## PHASE 4 — 우선순위 판정
P0 = 빌드/실행 불가, 데이터 손실, 심각한 보안 결함
P1 = 핵심 기능의 실제 버그
P2 = 기능·유지보수상 의미 있는 문제
P3 = 사소한 개선
P0 → P1 순으로 수정한다. P2는 실질 가치가 있을 때만, P3는 기본적으로 수정하지 않고 목록화한다.

## PHASE 5 — 수정
- 최소 diff. 한 문제 = 한 논리적 변경. 무관한 정리를 섞지 않는다.
- 계약을 바꿀 때는 shared 스키마 → route → `services/api.ts`를 함께 고친다.
- DB 변경은 새 migration 파일 추가로만 한다.
- 각 수정마다 `FINDINGS.md`에 severity·파일·원인·수정내용을 한 줄씩 추가한다.
- 회귀 위험이 있는 P0/P1 수정에는 가능하면 기존 vitest 파일에 테스트를 1개 추가한다(새 테스트 프레임워크 도입 금지).

## PHASE 6 — 회귀 검증
`npm run typecheck` → `npm test` → `npm run build` 순으로 재실행하고, 변경이 UI 흐름에 닿았다면 `npm run test:e2e`.
PHASE 0 기준선과 비교해 새로 깨진 것이 없음을 확인한다. 깨졌다면 고치거나 해당 변경을 되돌린다.
실패가 남아 있으면 숨기지 말고 실패 그대로 보고한다.

## 최종 보고 형식 (이 형식만 출력)
```
## 1. 수정한 문제
| P | 파일:라인 | 원인 | 수정 |
## 2. 검증 결과
typecheck / lint / test / build / e2e  → 각각 pass·fail + 기준선 대비 변화
## 3. 발견했으나 수정하지 않은 문제
- [P?] 파일 — 문제 — 미수정 이유
## 4. 추가 권장 작업
- 코드 변경 없이 목록만
```
보고 본문은 간결하게. 상세는 `FINDINGS.md`에 남긴다.

시작: PHASE 0의 명령 3개부터 실행하고, 그 출력에 근거해 읽을 파일을 정한다.
