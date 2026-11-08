# NEXORA / drive-mcp

**One Hub. Every Connection.**

NEXORA is a curated integration hub and remote MCP gateway. Its goal is to let users discover supported providers, authorize their own accounts, and expose approved tools through a secure, user-scoped MCP endpoint.

## Current status

This repository begins with the NEXORA web catalog shell. The Supabase project and initial catalog schema are provisioned separately. Provider cards are discovery metadata only; they do not imply that an OAuth flow or MCP adapter is already implemented.

## Stack

- Next.js App Router
- React
- Supabase (Auth, Postgres, Row Level Security)
- Cloudflare Workers (planned remote MCP gateway)

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Security requirements

- Never expose service-role keys or provider credentials to the browser.
- Store provider credentials encrypted server-side.
- Enforce per-user ownership and tool-level scopes.
- Require explicit approval for destructive or sensitive tools.
- Audit connection, authorization, and tool execution events.

## Roadmap

1. Connect the web app to Supabase Auth and the integration catalog.
2. Implement provider OAuth and API-key connection flows.
3. Build provider adapters and normalized tool discovery.
4. Implement authenticated Streamable HTTP MCP transport on Cloudflare Workers.
5. Add approval policies, audit logs, rate limits, and end-to-end tests.
