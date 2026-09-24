# Demo privacy and data handling

Project Espera is an independently operated beta demo. Do not enter confidential, regulated, or otherwise sensitive information.

## Data the demo stores

- GitHub account ID, display name, avatar URL, and email when GitHub provides one. Espera does not store the GitHub OAuth access token.
- Conversations, messages, projects, Persona settings, Memory candidates and revisions, Context Runs, and Provider connection metadata in Cloudflare D1, associated with the signed-in account.
- Session token hashes in D1. Session cookies are `HttpOnly`, `Secure`, and expire after 30 days; signing out invalidates the current session.
- Provider API keys stay in browser memory by default. If you choose **Remember key**, the Worker encrypts the key with AES-GCM before storing it in D1. The original key is not returned by the API.

When you send a message or request a model list, the selected Provider receives the data needed for that request under its own terms and privacy policy. The demo operator administers the Cloudflare account and can access the hosted service and its database; account separation in the app does not make the operator technically unable to access stored data. Application error logs omit request bodies and credentials.

## Deleting your data

Use **Account → Delete account** to delete the account and its Espera data from the live database. This also deletes any encrypted Provider key and signs you out. This action cannot be undone. GitHub's authorization for Espera can be revoked separately in your GitHub account settings.

The demo has no automatic conversation-retention period. If you do not want the demo to retain data, delete your account after use. Cloudflare may process service metadata under its own terms.

## Privacy notice (한국어)

Project Espera는 개인이 운영하는 베타 Demo입니다. 기밀 정보나 민감한 개인정보를 입력하지 마세요.

- 로그인에 사용한 GitHub 계정 ID, 프로필 이름, 아바타 URL과 GitHub가 제공하는 이메일을 저장합니다. GitHub OAuth access token은 저장하지 않습니다.
- 대화와 메시지, 프로젝트, Persona 설정, Memory 후보·revision, Context Run, Provider 연결 정보를 계정과 연결해 Cloudflare D1에 저장합니다.
- 세션 토큰은 해시 형태로 저장합니다. 세션 쿠키는 `HttpOnly`, `Secure`이며 30일 후 만료됩니다. 로그아웃하면 현재 세션을 폐기합니다.
- Provider API Key는 기본적으로 브라우저 메모리에만 둡니다. **계정에 API Key 기억하기**를 선택하면 Worker가 AES-GCM으로 암호화한 뒤 D1에 저장합니다. 원본 Key는 API 응답에 포함하지 않습니다.

메시지 전송과 모델 목록 요청에 필요한 데이터는 선택한 Provider로 전달되며, 해당 Provider의 약관과 개인정보 처리 방침이 적용됩니다. Demo 운영자는 Cloudflare 계정과 데이터베이스를 관리하므로 저장된 데이터에 기술적으로 접근할 수 있습니다. 애플리케이션 오류 로그에는 요청 본문이나 자격 증명을 기록하지 않습니다.

**계정 메뉴 → 계정 삭제**를 선택하면 운영 중인 데이터베이스에서 계정과 Espera 데이터를 삭제하고 로그아웃합니다. 저장된 암호화 API Key도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다. GitHub의 Espera 앱 권한은 GitHub 계정 설정에서 별도로 해제할 수 있습니다.

자동 대화 보존 기한은 설정되어 있지 않습니다. Demo 사용 후 데이터를 보존하지 않으려면 계정을 삭제하세요. Cloudflare는 자체 약관에 따라 서비스 메타데이터를 처리할 수 있습니다.
