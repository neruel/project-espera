# Changelog

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
