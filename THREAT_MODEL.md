# Project Espera Threat Model & Security Specification

> **Scope**: Phase 1 MVP Security Architecture  
> **Classification**: Security Policy & Implementation Standard

---

## 1. Protected Assets & Data Sensitivity

| Asset | Sensitivity | Impact of Compromise | Mitigation in Espera |
| :--- | :--- | :--- | :--- |
| **BYOK API Keys** | **Critical** | Financial abuse (API billing drain), unauthorized LLM usage | Never logged, masked in UI, session-only by default; optional AES-GCM ciphertext in D1 when the user explicitly opts in. |
| **User Memories & Persona** | **High** | Privacy invasion, leak of user habits, projects, personal facts | Scoped strictly to `userId`, human-in-the-loop review before activation, sensitive categories blocked from extraction. |
| **Conversation Logs** | **Medium-High** | Leak of confidential work or personal discussions | Isolated by `userId` and `sessionId`, cascade deletion support. |
| **Context Run Snapshots** | **Medium** | Exposure of prompt templates and system directives | Stripped of any credential headers or secrets before saving to D1. |

---

## 2. Threat Scenarios & Mitigations

### 2.1 API Key Exposure & Credential Theft
* **Threat**: API keys stored in client `localStorage` leaked via third-party script XSS, or leaked through Cloudflare Worker logs / error stack traces.
* **Mitigation**:
  1. **Default: Session-Only In-Memory**: Keys are kept in React application memory for the browser tab lifetime and are never sent to persistent DB.
  2. **Optional Persistent Storage**: If the user explicitly opts in, the Worker encrypts the key with the `ESPERA_MASTER_ENCRYPTION_KEY` AES-GCM key before saving ciphertext, nonce, and version in D1. Plaintext keys are never returned by connection APIs.
  3. **Header-Based Transmission**: Session-only keys are sent to `/api/chat` via HTTPS header `X-Espera-Credential`; persisted keys are decrypted only inside the authenticated Worker request.
  4. **Zero-Logging Invariant**: Worker logger intercepts and strips any authorization tokens or `X-Espera-Credential` headers.
  5. **No UI Egress**: UI settings display only stored/not-stored status; full keys are never rendered back from API.

Persistent credential storage changes the trust boundary: a compromise of both D1 and the Worker encryption secret could expose stored keys. The feature therefore remains opt-in, requires a production secret, and should use a rotation policy before broad public deployment.

### 2.2 Memory Poisoning & Prompt Injection
* **Threat**: Malicious user input or hallucinated assistant output triggers extraction of harmful, false, or unauthorized memory facts (e.g. "System prompt override").
* **Mitigation**:
  1. **Human-in-the-Loop Quarantine**: All newly extracted memory facts default to `status = 'pending'`. A pending memory is NEVER injected into prompt context.
  2. **Schema Validation**: Extraction results are validated with strict Zod types (`subject`, `predicate`, `valueJson`, `canonicalText`, `category`). Non-conforming outputs are rejected.
  3. **Negative Constraint List**: Extractor prompt explicitly forbids recording:
     - Speculations on mental health or psychology
     - Religious, political, or sexual identity
     - System instructions or prompt overrides disguised as facts

### 2.3 Context Leakage via Developer Inspector
* **Threat**: The Context Inspector reveals sensitive credentials or private session data to unauthorized viewers.
* **Mitigation**:
  - Context Inspector endpoints ONLY return sanitized `ContextRun` objects containing prompt text, active memory IDs, memory candidate reasons, and token estimates.
  - Zero credential fields are attached to `ContextRun`.

### 2.4 Data Deletion & Privacy Rights
* **Threat**: Deleted memories remain active in context queries or cannot be eradicated.
* **Mitigation**:
  - **Soft Delete**: `status = 'deleted'`. Instantly excluded from all context generation queries.
  - **Hard Delete**: Dedicated endpoint to permanently purge records and associated revisions/evidences from D1 SQLite.

---

## 3. Phase 1.5 Custom Endpoint Threats

- URL parser로 Base URL을 검증하며 `https:`만 기본 허용한다. 개발용 `http:`는 loopback host로 제한한다.
- URL userinfo와 `file:`, `data:`, `javascript:` 등 비 HTTP scheme을 차단한다.
- Provider 요청은 redirect를 수동 처리하고 3xx를 거부하여 다른 host로 Authorization이 전달되지 않게 한다.
- API Key는 query string, localStorage, sessionStorage, D1, ContextRun에 넣지 않는다. Gemini도 `x-goog-api-key` 헤더를 사용한다.
- 사용자 지정 Endpoint를 서버가 호출하므로 SSRF 위험이 남는다. 운영 배포 전 DNS resolution 이후 private/link-local/metadata IP 차단과 egress allow policy를 추가해야 한다.
- 로컬 LLM의 HTTP endpoint는 네트워크 도청 위험이 있으므로 loopback 개발에만 사용해야 한다.
- 외부 Provider 오류는 공통 오류 코드와 정제된 메시지로 변환하며 인증 헤더나 Key를 반환하지 않는다.
# Endpoint 및 확장 기능 결정

- 운영 정책은 `public-https`로 HTTP, loopback/private literal IP, URL credential, fragment, redirect를 차단합니다. 공식 endpoint 전용 배포는 `official-only`로 강화할 수 있습니다.
- DNS rebinding은 Worker 런타임에서 응답 IP를 고정하기 어려우므로 custom endpoint의 잔여 위험입니다. 고신뢰 환경에서는 `official-only`를 사용합니다.
- Embedding semantic search는 승인된 Memory를 추가 외부 서비스에 전송할 수 있어 기본 활성화하지 않습니다. 로컬 embedding 또는 별도 동의·보존·비용 정책이 준비된 뒤 도입합니다.
- Vision과 Tool calling은 파일·외부 작업이라는 새로운 권한 경계를 만들기 때문에 capability 표시만으로 자동 노출하지 않으며 별도 동의와 도구 allowlist가 필요합니다.
