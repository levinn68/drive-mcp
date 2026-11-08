# DRIVE / drive-mcp

**One Hub. Every Connection.**

DRIVE is an MCP server directory and connection platform. It imports server metadata from the official MCP Registry, adds discovery and trust signals, and will let users connect supported remote MCP servers or register custom endpoints.

## Current implementation

- Next.js App Router directory page.
- Live read-only import from the official MCP Registry API: `https://registry.modelcontextprotocol.io/v0.1/servers`.
- Uses `version=latest`, cursor pagination and registry search (minimum three characters).
- Server-side fetch with a one-hour cache.
- Displays registry metadata, publisher server name, version, repository and transport hints.
- Clear warning that registry listing does not equal security verification or connection readiness.

## Important transport distinction

- Remote servers can expose Streamable HTTP transport and may be connectable after authentication and compatibility checks.
- Package-based STDIO servers are not automatically remote. They require an isolated hosted runtime before DRIVE can execute them.
- Registry metadata is untrusted input. Never execute package commands or connect to a server merely because it appears in the directory.

## Stack

- Next.js App Router / React
- Supabase Postgres + RLS for user connections, policies and audit events
- Cloudflare Workers for the future authenticated MCP gateway

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Security requirements

- Never expose service-role keys or provider credentials to the browser.
- Store credentials encrypted server-side and isolate them per user.
- Enforce per-user ownership and tool-level scopes.
- Require explicit approval for destructive or sensitive tools.
- Audit connection, authorization and tool execution events.
- Apply timeouts, rate limits, SSRF protection and allowlists to remote MCP connections.
- Do not execute untrusted STDIO packages in the web application process.

## Roadmap

1. Add custom remote MCP registration and validation.
2. Add registry-source provenance, deduplication and sync status.
3. Add server security and compatibility verification.
4. Implement authenticated Streamable HTTP MCP transport on Cloudflare Workers.
5. Add isolated hosted STDIO runtime support.
6. Connect Supabase Auth, per-user connections, tool policies and audit logs.
7. Add automated tests and deployment checks.
