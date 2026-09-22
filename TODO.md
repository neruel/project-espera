# Project Espera TODO

현재 코드와 제품 문서를 대조해 정리한 개선 백로그입니다. 우선순위는 사용자 신뢰와 데이터 안전에 미치는 영향을 기준으로 정했습니다.

## P0 — 공개 운영 전에 반드시 해결

- [x] 모든 Memory 상세 조회·승인·거절·수정·삭제 route에서 `userId`와 resource owner를 함께 검증한다.
- [x] Memory evidence와 revision 조회에도 동일한 소유권 검사를 적용한다.
- [x] 인증이 필요한 운영 환경에서 인증 상태 조회 실패와 실제 비인증 상태를 구분해 처리한다.
- [x] 삭제·수정·승인 요청에 대한 반복 클릭과 동시 요청을 서버와 UI 양쪽에서 방지한다.

## P1 — 핵심 사용자 흐름 안정화

- [x] Chat Provider 실패 시 서버에 저장된 사용자 메시지와 클라이언트 화면 상태를 일치시킨다.
- [x] 스트리밍 중 중단했을 때 부분 응답을 저장하지 않고 재시도하도록 정책을 정의한다.
- [x] Conversation의 마지막 선택 상태를 새로고침 후 복원한다.
- [x] Project 생성·수정·삭제 후 App, Chat, Projects 화면의 목록을 즉시 동기화한다.
- [x] Chat에서 변경한 Project scope를 Conversation metadata에 저장한다.
- [x] 저장된 Provider connection에 API Key를 계정 단위로 암호화 저장하고 로그인 후 자동 사용한다. (선택 기능)
- [x] 저장된 Provider connection을 다시 선택하고 API Key를 재입력·검증하는 흐름을 추가한다.
- [x] Provider 연결 저장 전에 모델 목록 상태와 API Key 필수 여부를 명확히 표시한다.
- [x] 주요 조회·변경 API 오류를 인라인/전역 상태로 표시하고 Retry 경로를 제공한다.
- [x] 오래된 Conversation을 불러오는 pagination 또는 “이전 메시지 불러오기”를 추가한다.

## P1 — Memory 신뢰 경험

- [x] Memory 승인 시 이후 Context와 모든 Provider에 사용될 수 있다는 영향 범위를 명시한다.
- [x] Memory action별 loading, 성공, 실패, 중복 클릭 방지 상태를 추가한다.
- [x] Memory 목록에 Project scope와 evidence의 출처 Message를 표시한다.
- [x] Memory 상세 모달에 로딩·오류·evidence 상태를 추가한다.
- [x] Memory 거절 버튼에 텍스트와 `aria-label`을 제공한다.
- [x] Memory 검색을 서버 키워드 검색과 pagination·유형·프로젝트·정렬 필터 구조로 확장한다.

## P2 — Chat 사용성 개선

- [x] 사용자 메시지·주요 CTA의 순백색 대비를 낮춰 장시간 사용 시 눈부심을 줄인다.
- [x] Context Inspector 진입점을 현재 대화 헤더로 단일화한다.
- [x] 계정 메뉴를 사이드바 폭에 맞추고 바깥 클릭·Escape·로그아웃 진행 상태를 지원한다.
- [x] 전체 Markdown과 안전한 링크 렌더링을 지원한다.
- [x] 메시지별 복사·재생성·삭제 기능을 추가한다.
- [x] 사용자가 과거 메시지를 읽는 중이면 자동 스크롤을 강제하지 않는다.
- [x] 스트리밍 응답에 Stop, Retry, 부분 응답 폐기 정책을 명확히 한다.
- [x] 모바일에서 Project·Provider·Model 선택을 bottom sheet로 제공한다.
- [x] 첫 사용자 메시지로 대화 제목을 자동 생성하고 수동 제목 수정도 지원한다.
- [x] 새 채팅 클릭 시 빈 Conversation을 즉시 DB에 만들지 않고 첫 메시지 전송 시 생성한다.
- [x] 현재 대화 삭제 시 Sidebar가 다음 Conversation을 자동 선택한다.
- [x] Navbar와 ChatView의 Conversation 상태를 App 단일 source of truth로 통합한다.

## P2 — Persona와 Project 관리

- [x] Persona 로딩·저장 실패를 무한 로딩이나 browser alert 대신 인라인 상태로 표시한다.
- [x] Persona revision 비교와 이전 버전 복원 기능을 추가한다.
- [x] Project 이름·설명·상태 수정 기능을 추가한다.
- [x] Project 상세 화면에서 연결된 Conversation과 Memory를 보여준다.
- [x] Project 삭제 시 현재 Chat scope를 안전하게 Global로 전환한다.

## P2 — 접근성 및 국제화

- [x] 사용자 노출 문자열을 한국어·영어 전환 경로로 제공하고 공통 핵심 문구는 i18n 사전에서 관리한다.
- [x] 모달에 dialog role, Escape 닫기, focus trap, 닫힌 뒤 focus 복원을 일관되게 적용한다.
- [x] 모든 주요 select와 icon-only button에 accessible name을 추가한다.
- [x] 버튼과 입력 요소에 `:focus-visible` 스타일을 추가한다.
- [x] 작은 회색 텍스트와 상태 색상의 명도 대비를 높인다.
- [x] 브라우저 기본 `alert`·`confirm`을 앱 내 인라인 상태·Dialog 컴포넌트로 교체한다.

## P3 — 제품 확장

- [x] 오래된 Conversation 구간은 비신뢰 extractive summary로 압축하고 최근 메시지는 원문으로 유지한다.
- [x] Memory semantic search의 개인정보·비용 경계를 검토하고 현재 릴리스에서는 서버 lexical search를 채택한다.
- [x] Vision·Tool calling은 별도 권한·파일 전송·도구 allowlist가 필요한 opt-in 확장으로 설계 결정한다.
- [x] `public-https`, `official-only`, `development-local` endpoint 정책과 custom endpoint 잔여 위험을 문서화한다.
- [x] 실제 Provider 모델 조회 smoke를 명시적 opt-in, 최대 3요청, 생성 요청 0회로 제한한다.

## 문서와 구현을 함께 갱신할 항목

- [x] README의 현재 UX와 운영 검증 설명을 실제 구현에 맞게 갱신한다.
- [x] `project.md`의 Context Engine, 데이터 격리, 반응형 UI 설명을 실제 동작과 함께 갱신한다.
- [x] 배포 전 `typecheck`, 25개 test, lint, build, 3개 E2E를 모두 통과한다.
