# Project Espera 기술 및 구조 설명서

## 1. 제품 목적

Project Espera의 목적은 사용자의 개인적 맥락을 특정 LLM 서비스에서 분리하는 것입니다.

ChatGPT, Claude, Gemini 또는 로컬 모델은 계속 교체될 수 있습니다. Espera는 모델 자체가 아니라 다음 정보를 지속적으로 관리합니다.

- 사용자가 누구인지
- 사용자가 진행 중인 프로젝트
- 사용자가 승인한 장기 기억
- AI가 사용자를 대하는 방식
- 과거 대화와 현재 대화의 연결

핵심 성공 기준은 모델을 바꿔도 사용자가 같은 맥락을 이어가는 AI를 경험하는 것입니다.

## 2. 전체 구조

```text
React UI
  ├─ Chat / Memory / Persona / Projects
  ├─ Provider Settings / Account / Language
  └─ Context Inspector
        │
        ▼
Cloudflare Worker API (Hono)
  ├─ Authentication boundary
  ├─ Context Engine
  ├─ Memory Engine
  ├─ Provider Registry / Adapters
  └─ Repository layer
        │
        ▼
Cloudflare D1
  ├─ users / sessions
  ├─ conversations / messages
  ├─ memories / evidence / revisions
  ├─ personas / revisions
  ├─ projects
  ├─ provider connection metadata
  └─ context runs
```

## 3. 멀티유저 인증

GitHub OAuth와 자체 세션으로 구성됩니다.

1. GitHub OAuth state를 D1과 HttpOnly cookie에 저장합니다.
2. callback에서 code를 교환합니다.
3. GitHub provider subject로 `users`를 upsert합니다.
4. 무작위 session token의 SHA-256 hash만 `sessions`에 저장합니다.
5. 원본 token은 Secure, HttpOnly cookie로 전달합니다.

모든 API 요청은 세션의 `userId`를 Hono context에 설정합니다. Production은 `ESPERA_AUTH_MODE=required`이며 인증되지 않은 사용자는 health와 auth endpoint를 제외한 API에 접근할 수 없습니다.

## 4. 도메인 모델

### User

GitHub identity와 연결된 사용자입니다. 모든 개인 데이터의 최상위 scope입니다.

### Conversation / Message

Conversation은 실제 대화 기록이고 Message는 user, assistant, system 메시지입니다. 대화 원문 전체를 장기 Memory로 복사하지 않습니다.

### Memory

장기적으로 재사용할 가치가 있는 구조화된 정보입니다.

```text
pending → active
        ↘ rejected
active → superseded / retracted / expired / deleted
```

명시적 사실과 AI 추론을 구분하며, 후보는 사용자가 승인하기 전까지 일반 Context에 포함하지 않습니다. Evidence와 revision으로 출처와 변경 이력을 추적합니다.

### Persona

AI의 대화 방식, 어조, 행동 원칙입니다. Memory와 분리되어 있으며 변경은 revision으로 기록됩니다.

### Project

전역 Memory와 구분되는 작업 단위입니다. 프로젝트 설명과 project-scoped Memory가 Context에 선택적으로 포함됩니다.

## 5. Context Engine

새 메시지가 들어오면 다음 정보를 조합합니다.

```text
Persona + Project context + 관련 active Memory
       + 최근 Message + 현재 요청
       → Provider request
```

긴 Conversation은 최근 메시지를 원문으로 유지하고 오래된 구간을 길이 제한이 있는 extractive summary로 압축합니다. 이 summary는 비신뢰 대화 기록으로 표시되어 내부의 명령형 문장을 system instruction으로 취급하지 않습니다. Context Inspector는 summary를 포함한 prompt 구성, 선택된 Memory와 선택 이유, Persona version, Provider, Model, 길이 추정치를 보여줍니다. API Key와 authorization header는 포함하지 않습니다.

## 6. Provider abstraction

핵심 도메인은 특정 SDK 타입을 사용하지 않고 공통 Adapter 인터페이스를 사용합니다.

```text
validateConnection
listModels
generate
stream
getCapabilities
```

현재 지원 구조는 Mock, OpenAI, Anthropic, Gemini, OpenAI-compatible입니다. OpenRouter, LM Studio, vLLM은 OpenAI-compatible Adapter로 사용할 수 있습니다.

## 7. BYOK 보안

사용자 API Key의 기본 lifecycle은 다음과 같습니다. 사용자가 명시적으로 저장을 선택한 경우에는 Worker Secret 기반 암호화 저장 경로를 사용합니다.

```text
입력 → 현재 탭 메모리 또는 암호화 저장 → 요청 header/서버 복호화 → Provider Adapter
```

저장하지 않는 기본 모드에서는 API Key가 D1, localStorage, sessionStorage, URL, 로그, Context run, Inspector에 저장되지 않습니다. 저장 모드를 선택하면 D1에는 AES-GCM ciphertext, nonce, version만 저장되고 원본 Key는 API 응답에 포함되지 않습니다. Provider connection에는 이름, Provider type, Base URL, model catalog 같은 metadata도 함께 저장합니다.

## 8. 데이터 격리

모든 repository와 resource mutation route는 `userId`를 필수 scope로 사용해야 합니다. Memory 상세 조회·상태 변경·삭제·evidence·revision 조회에도 owner 검증을 적용합니다.

- 다른 사용자의 Conversation과 Message를 조회할 수 없습니다.
- 다른 사용자의 Memory와 Evidence를 조회하거나 변경할 수 없습니다.
- 다른 사용자의 Persona와 Project를 수정할 수 없습니다.
- 다른 사용자의 Provider metadata를 조회할 수 없습니다.

수정과 삭제 route에서도 resource ID와 owner를 함께 검사합니다.

## 9. Frontend 구조

```text
packages/client/src/
  App.tsx                 # 인증, 탭, 데이터 초기화
  i18n.tsx                # 한국어/영어 언어 상태와 사전
  services/api.ts         # credentials 포함 API client
  stores/session.ts       # 비밀값을 제외한 브라우저 상태
  components/
    Chat/                 # ChatGPT 스타일 workspace
    Memory/               # Memory Inbox와 lifecycle UI
    Persona/              # Persona 편집과 revision
    Projects/             # Project 관리
    Settings/             # Provider와 언어 설정
    Auth/                 # Login UI
    Account/              # 계정 메뉴
```

언어 설정은 `ko`와 `en`을 지원하며 `espera_language` 키로 브라우저에 저장됩니다. API 데이터와 사용자 API Key는 저장하지 않습니다.

## 10. 반응형 UI

Desktop에서는 상단 navigation과 좌측 conversation sidebar를 사용합니다. 모바일에서는 conversation sidebar가 drawer로 전환되고 backdrop을 눌러 닫을 수 있습니다.

- 모바일에서 대화 목록은 overlay drawer입니다.
- 모바일의 Project, Provider, Model 선택은 별도 bottom sheet로 제공됩니다.
- Chat composer는 화면 폭에 맞게 축소됩니다.
- Memory와 Project 카드는 단일 열로 전환됩니다.
- Settings form은 모바일에서 한 열로 전환됩니다.

## 11. 보안 경계

- GitHub OAuth secret은 Cloudflare secret입니다.
- session token은 hash만 D1에 저장합니다.
- API Key는 기본적으로 session-only이며 사용자가 선택한 경우 Worker master secret으로 AES-GCM 암호화해 저장합니다.
- CORS는 production frontend origin으로 제한합니다.
- endpoint URL은 공통 검증과 redirect 차단을 거쳐야 하며, 임의 custom host에 대한 DNS rebinding 방어는 Worker 환경의 한계로 완전하지 않습니다.
- Provider 오류는 정규화하고 credential을 redaction합니다.
- Context Inspector는 인증정보를 표시하지 않습니다.

## 12. 배포 구성

```text
Cloudflare Pages: project-espera-web
        │
        ▼
Cloudflare Worker: project-espera-api
        │
        ▼
Cloudflare D1: project-espera-db
```

Worker URL의 `hfainvididual.workers.dev`는 Cloudflare 계정 기본 workers.dev 서브도메인이고 실제 Worker 이름은 `project-espera-api`입니다.

## 13. 테스트 전략

- Vitest: domain, repository, provider, security, auth
- Playwright: 주요 UI와 E2E 흐름
- Mock Provider: 외부 API Key 없는 연속성 검증
- production smoke: health, CORS, persistence, credential redaction

실제 유료 Provider 호출은 기본 테스트에서 제외합니다.
