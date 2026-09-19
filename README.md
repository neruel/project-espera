# Project Espera (프로젝트 에스페라)

> **"모델이 바뀌어도 나를 기억하는 개인용 지속형 AI 시스템"**  
> Cloudflare Workers + Cloudflare D1 + React/Vite (PWA Ready) 기반의 모델 독립적 장기 기억 및 페르소나 엔진

---

## 1. 프로젝트 개요

Project Espera는 단순한 LLM 채팅 래퍼가 아닙니다.  
OpenAI GPT-4o, Anthropic Claude 3.5, Google Gemini, 로컬 LLM 등 **어떤 추론 엔진으로 전환하더라도 사용자의 Persona, Long-term Memory, 대화 히스토리, 프로젝트 맥락이 온전히 유지**되는 개인용 지속형 AI 시스템입니다.

### 핵심 설계 원칙
1. **Stateless LLM**: AI 모델은 언제든 교체 가능한 연산 엔진일 뿐, 기억과 페르소나는 Espera의 D1 관계형 데이터베이스가 소유합니다.
2. **Provider-Independent Domain**: 특정 AI 기업의 SDK 타입이 도메인 계층으로 전파되지 않습니다.
3. **맥락의 연속성 (Context Continuity)**: 모델 가중치가 다르므로 어투나 문장은 달라질 수 있지만, 사용자의 직업, 진행 중인 프로젝트, 선호도, 제약조건 맥락은 끊김 없이 이어집니다.
4. **Human-in-the-Loop 기억 통제**: 대화 중 추출된 지식은 즉시 확정되지 않고 **Memory Inbox(보류 상태)**에 격리되며, 사용자가 직접 승인/수정/거절합니다.
5. **D1 Single Source of Truth**: 모든 관계형 데이터와 변경 이력은 Cloudflare D1에 저장됩니다. Vector DB는 원본 저장소가 아니라 보조 검색 인덱스로만 취급합니다.
6. **BYOK 보안 (Session-Only Default)**: 민감한 API Key는 서버 DB에 영구 저장하지 않고 브라우저 세션 메모리에만 유지하는 안전한 BYOK 모델을 제공합니다.

---

## 2. 모노레포 구조

```
Project Espera/
├── ARCHITECTURE.md              # 상세 아키텍처 및 ADR (Architecture Decision Records)
├── THREAT_MODEL.md              # 위협 모델 및 보안 명세서
├── README.md                    # 프로젝트 실행 및 종합 가이드
├── .env.example                 # 환경 설정 템플릿
├── package.json                 # 루트 npm 워크스페이스 정의
├── vitest.config.ts             # Vitest 통합 테스트 환경 설정
│
├── packages/
│   ├── shared/                  # 도메인 모델, 공통 타입, Zod 스키마
│   │   ├── src/types/domain.ts  # User, Persona, Memory, Message, Provider 규격
│   │   └── src/schemas/index.ts # Memory 후보 검증 및 API Zod 스키마
│   │
│   ├── server/                  # Cloudflare Workers + Hono 엣지 백엔드
│   │   ├── migrations/          # Cloudflare D1 SQLite 마이그레이션 SQL
│   │   │   └── 0001_initial_schema.sql
│   │   ├── src/
│   │   │   ├── db/              # D1 추상화 및 Repository 계층 (User, Memory, Persona, Conv)
│   │   │   ├── providers/       # MockProvider, OpenAIProvider, AnthropicProvider
│   │   │   ├── context/         # Context Engine (페르소나/메모리/토큰 예산 합성)
│   │   │   ├── memory/          # Memory Engine (후보 추출, 중복/충돌 탐지, 라이프사이클)
│   │   │   ├── security/        # API Key 마스킹, AES-GCM 암호화 유틸리티
│   │   │   ├── routes/          # Hono API 라우트 (chat, memories, persona, inspector)
│   │   │   ├── app.ts           # Hono 애플리케이션 진입점
│   │   │   ├── dev-server.ts    # 로컬 개발 서버 러너
│   │   │   └── index.ts         # Cloudflare Worker 진입점
│   │   └── src/tests/           # Vitest 유닛 및 10단계 시나리오 통합 테스트
│   │
│   └── client/                  # Vite + React + TypeScript + Tailwind 반응형 웹 UI
│       └── src/
│           ├── components/
│           │   ├── Chat/        # 반응형 대화 UI, SSE 스트리밍, 모델 스위처
│           │   ├── Memory/      # Memory Inbox (승인/수정/거절), 활성 기억, 감사 이력
│           │   ├── Persona/     # 페르소나 에디터 및 버전 이력
│           │   ├── Settings/    # BYOK API Key 관리 및 Provider 연결 테스트
│           │   └── Inspector/   # Developer Context Inspector (프롬프트/메모리 사유 검사)
│           ├── services/api.ts  # 스트리밍 SSE 및 백엔드 연동 클라이언트
│           └── stores/session.ts# 브라우저 세션 전용 보안 키 스토어
```

---

## 3. 개발 환경 실행 방법

### 3.1 필수 도구
* Node.js v20+ (Node v24 권장)
* npm v10+

### 3.2 의존성 설치
```bash
npm install
```

### 3.3 로컬 개발 서버 실행 (Frontend & Backend 동시 실행)
```bash
npm run dev
```
* **Client (Web UI)**: `http://localhost:5173`
* **Server (API)**: `http://127.0.0.1:8787`

> *개별 실행:*  
> * 서버 단독 실행: `npm run dev:server`  
> * 클라이언트 단독 실행: `npm run dev:client`

---

## 4. 검증 및 테스트 실행

### 4.1 Vitest 전체 테스트 실행 (Unit & Integration)
외부 유료 API Key 없이 내장된 `MockProvider`와 인메모리 SQLite를 통해 100% 자동 검증됩니다:
```bash
npm test
```

### 4.2 타입스크립트 타입 체크
```bash
npm run typecheck
```

### 4.3 프로덕션 빌드
```bash
npm run build
```

---

## 5. Phase 1 MVP 핵심 루프 검증 시나리오

1. **사용자 메시지 입력**:
   `"나는 컴퓨터공학을 공부하고 있고 Project Espera를 만들고 있다"` 입력
2. **응답 및 기억 후보 추출**:
   채팅 응답이 즉시 스트리밍되며, 백그라운드에서 `[전공 분야: 컴퓨터공학]`, `[진행 프로젝트: Project Espera]` 2건의 지식이 `pending` 상태로 Memory Inbox에 등록됩니다.
3. **사용자 승인 (Human-in-the-Loop)**:
   상단 네비게이션의 `기억 보관소`로 이동하여 후보 카드를 확인하고 `[승인]` 버튼을 클릭하여 `active` 상태로 승격합니다.
4. **새 대화 생성 및 모델 전환 (Cross-Provider Continuity)**:
   새 대화방을 열고 모델을 `Mock Alpha`에서 `Mock Beta`로 변경한 뒤, `"내가 진행 중인 프로젝트가 무엇이지?"`라고 질문합니다.
5. **맥락 연속성 확인**:
   모델이 바뀌었음에도 `[Project Espera]` 기억이 컨텍스트로 자동 주입되어 프로젝트 정보를 완벽하게 답변합니다.
6. **Developer Context Inspector**:
   우측 상단 `Inspector` 버튼을 누르면 어떤 Memory ID가 어떤 사유(`keyword_matches=1, importance_score=5`)로 선택되었는지와 합성된 시스템 프롬프트를 투명하게 확인할 수 있습니다.

---

## 6. Cloudflare 프로덕션 배포 가이드

### 6.1 D1 데이터베이스 생성
```bash
npx wrangler d1 create espera_db
```
출력된 `database_id`를 `packages/server/wrangler.toml`에 반영합니다.

### 6.2 D1 마이그레이션 적용
```bash
# 로컬 개발 환경
npx wrangler d1 execute espera_db --local --file=./packages/server/migrations/0001_initial_schema.sql

# 원격 프로덕션 환경
npx wrangler d1 execute espera_db --remote --file=./packages/server/migrations/0001_initial_schema.sql
```

### 6.3 Worker 백엔드 배포
```bash
cd packages/server
npx wrangler deploy
```

### 6.4 Pages 프론트엔드 배포
```bash
cd packages/client
npm run build
npx wrangler pages deploy dist --project-name=espera-web
```

---

## 7. Phase 2 로드맵 및 백로그

- [ ] **Cloudflare Vectorize + Workers AI 연동**: D1의 Active Memory를 `bge-m3` 임베딩을 통해 Vectorize에 보조 인덱싱하여 의미론적 유사도 검색 결합 (Hybrid RAG).
- [ ] **PWA 완전 패키징**: Web App Manifest 및 Service Worker 오프라인 캐싱, 모바일 홈 화면 설치 UX 최적화.
- [ ] **D1 서버 암호화 BYOK 동기화**: Web Crypto AES-GCM 256과 Cloudflare Worker Secret 마스터 키를 이용해 기기 간 API Key 암호화 동기화 기능 추가.
- [ ] **프로젝트 단위 컨텍스트 분리**: 복수의 작업 공간/프로젝트(Project A, Project B)별 독립 기억 격리.
- [ ] **로컬 LLM (Ollama) 및 오픈소스 모델 WebGPU 지원**.

---

## 8. 사용자 결정이 필요한 미해결 항목

1. **사용자 인증 (Auth) 서비스**:
   * 개인용 로컬 단일 사용자 모드 vs Cloudflare Access / Clerk / Supabase Auth를 통한 다중 사용자 SaaS 확장 여부.
2. **운영 환경 마스터 키 관리 정책**:
   * 서버 암호화 키를 Cloudflare Worker Secret 환경 변수로 고정할 것인지, KMS(Key Management Service)와 연동할 것인지.
3. **우선 지원 상용 Provider 2곳**:
   * 현재 구현된 `OpenAI` 및 `Anthropic` 외에 `Google Gemini` 및 `Groq` 중 우선 공식 지원할 프로바이더 확정.
4. **민감 기억 보존 및 완전 삭제 정책**:
   * Soft Delete(`deleted` 플래그) 보관 기간 및 Hard Delete 영구 파기 정책 결정.

---

## Phase 1.5: Open WebUI 스타일 Provider 연결

설정 화면에서 공식 OpenAI, Anthropic, Google Gemini 또는 OpenAI-compatible API의 **Base URL + API Key**를 입력하고 모델 목록을 조회할 수 있습니다. 조회된 모델은 연결별로 Chat 모델 선택기에 표시됩니다. 모델 목록 API가 없는 서버는 수동 Model ID를 추가할 수 있습니다.

### 연결 예시

- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Gemini: `https://generativelanguage.googleapis.com/v1beta`
- LM Studio(OpenAI-compatible): `http://localhost:1234/v1`
- vLLM(OpenAI-compatible): 배포 서버의 `/v1` Base URL

`/v1`은 정규화되므로 `/v1/v1/models`로 중복되지 않습니다. 운영 환경에서는 HTTPS만 허용하며 `localhost`, `127.0.0.1`, `::1`만 개발용 HTTP가 허용됩니다.

### API Key 정책

- 키는 React 메모리에만 존재하며 `localStorage`, `sessionStorage`, D1에 저장되지 않습니다.
- 새로고침하면 키와 탭 연결이 사라지므로 다시 입력해야 합니다.
- 키는 URL/query string이 아니라 POST 요청의 `X-Espera-Credential` 헤더로 서버에 전달됩니다.
- 서버는 Provider 호출 때만 사용하며 ContextRun이나 응답에 저장하지 않습니다.
- 연결 이름·기본 모델 같은 비밀이 아닌 선택값만 브라우저 환경설정으로 저장할 수 있습니다.

### 지원 현황

| Provider | 모델 조회 | 채팅 | 스트리밍 | 비고 |
|---|---:|---:|---:|---|
| Mock | O | O | O | 키 없이 오프라인 테스트 |
| OpenAI | O | O | O | 실제 키로 최종 실연동 필요 |
| Anthropic | O | O | O | `/v1/models` 사용 |
| Google Gemini | O | O | 부분 | 현재 응답을 공통 스트림 이벤트로 전달 |
| OpenAI-compatible | O | O | O | LM Studio/vLLM 등, 서버 호환성에 따라 다름 |

상용 API는 저장소에 실제 Key가 포함되지 않아 빌드 환경에서 라이브 호출까지 자동 검증하지 않습니다. Mock HTTP 테스트로 응답 정규화와 비밀정보 비노출을 검증합니다.

### 검증

```bash
npm install
npm run typecheck
npm test
npm run build
```

현재 ESLint 설정은 포함하지 않습니다. 정적 검사는 각 workspace의 TypeScript strict typecheck로 수행합니다.

### 알려진 제한사항

- Node 개발 서버는 테스트용 인메모리 SQLite를 사용하므로 재시작 시 데이터가 초기화됩니다. 실제 영속 개발은 Wrangler local D1 구성이 필요합니다.
- 서버 측 임의 Endpoint proxy는 SSRF 위험이 있습니다. 현재 scheme·userinfo·redirect를 차단하지만, 운영 배포 전 DNS/IP 기반 private-network 차단을 추가해야 합니다.
- Gemini는 현재 진정한 delta 스트리밍 대신 완성 응답을 공통 스트림 형식으로 전달합니다.
- 사용자 인증은 아직 없으며 `user_default` 개인용 구조입니다.
