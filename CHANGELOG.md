# Changelog

## 1.0.0 - 2026-09-26

First stable release of Project Espera.

### Interface redesign

- Replaced the top navigation bar and mobile bottom sheet with a ChatGPT-style layout: a collapsible left sidebar with new chat, chat search, Projects/Memory/Persona links, conversations grouped by Today, Yesterday, Previous 7 days, Previous 30 days, and month, a rename/delete menu per conversation, and the account menu at the bottom. On mobile the sidebar is a slide-in drawer.
- Moved Settings into a dialog. The General tab covers theme (light, dark, system), language (Korean, English), and keyboard shortcuts; the Connections tab lists saved connections and the add-connection form.
- Added Quick setup presets for OpenAI-compatible connections: FactChat, OpenRouter, DeepSeek, and Groq. The FactChat preset fills in `https://factchat-cloud.mindlogic.ai/v1/gateway`.
- Added a model picker in the chat header, a centered empty state with the composer, a project scope picker in the composer, and copy/regenerate/delete message actions.
- Added light and dark themes, a self-hosted Pretendard font, and a new monochrome starlight logo and favicon. The in-app logo follows the text color, so it is black in the light theme and white in the dark theme.
- Error messages are now fully localized. The UI shows a Korean or English message chosen from the server's error code (for example an invalid API key, a rate limit, or an unreachable server) instead of the raw English server text.
- Added keyboard shortcuts: `Ctrl+Shift+O` new chat, `Ctrl+Shift+S` toggle sidebar, `Ctrl+K` or `/` search chats.

### Security and hardening

- Untrusted remote images in AI replies are no longer rendered as Markdown images, preventing data exfiltration through attacker-controlled image URLs.
- Expired OAuth state and session rows are purged.
- Memory edits now check ownership and lifecycle status more strictly.
- Conversation and context-run lookups now require a user ID. Auth mode defaults to `required`; only the local dev server opts into `optional`.
- Chat requests that omit `projectId` for an existing conversation now inherit that conversation's project context.
- Saving a provider connection with an ID owned by another user now creates a new connection instead of failing with a server error.
- A provider rejecting an API key (upstream 401 or 403) is now reported as `422` instead of `401`, so a wrong key during model discovery or connection validation shows an error instead of signing the user out.

### Deployment

- The client login origin is configurable at build time with `VITE_AUTH_ORIGIN`. Production builds default to the hosted Worker and development builds use the same origin. The Pages Function continues to read `ESPERA_API_ORIGIN`.
- Documented the full self-hosting flow in `DEPLOYMENT.md`.
- Added an MIT license.
- Removed the internal `CURRENT_STATE.md` status notes; release history now lives in this changelog.

## 1.0.0-beta.3 - 2026-09-24

- Added `factchat-cloud.mindlogic.ai` to the hosted OpenAI-compatible API allowlist.
- Confirmed the FactChat HTTPS endpoint is reachable; configure its Base URL as `https://factchat-cloud.mindlogic.ai/v1/gateway`.
- This release changed only the Worker allowlist; the hosted Pages client stayed on the beta.2 build.

## 1.0.0-beta.2 - 2026-09-24

- Added hosted support for OpenAI-compatible APIs from the configured provider host allowlist: OpenRouter, DeepSeek, Groq, Together, Fireworks, Mistral, xAI, Cerebras, SiliconFlow, Novita, Perplexity, Venice, Z.ai, and MiniMax.
- Restricted hosted endpoint calls to approved HTTPS hosts on port 443; arbitrary hosts and IP-literal URLs are rejected.
- Explained that the selected API provider receives the API key and conversation content needed for requests.
- Documented endpoint allowlist configuration and residual SSRF risks for custom self-hosted deployments.

## 1.0.0-beta.1 — 2026-09-24

First public beta of Project Espera.

- GitHub sign-in with per-account conversations, projects, Persona, and user-reviewed Memory.
- Mobile-safe OAuth session handoff through the Cloudflare Pages origin.
- BYOK support with browser-memory defaults and optional AES-GCM encrypted account storage.
- Self-service account deletion, including account-owned data and saved encrypted keys.
- Production API authentication by default, write-origin checks, security headers, and an official-provider endpoint allowlist.
- Cloudflare Pages and Workers deployment documentation and a live Demo.

### Beta limits

- GitHub is the only sign-in provider.
- Memory lookup is keyword-based; semantic search, vision, and tool calling are not included.
- The hosted Demo accepts official OpenAI, Anthropic, and Google endpoints. OpenAI-compatible endpoints are available in self-hosted deployments.
- Real Provider requests require the user's own API key and may incur charges from that Provider.
