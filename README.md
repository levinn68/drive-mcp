# DRIVE

**One Hub. Every Connection.**

DRIVE is a directory for finding MCP servers and a workspace for managing remote MCP connections. The directory reads from the official MCP Registry; custom endpoints are stored privately per signed-in user.

## What is in the repository

- `app/page.js` — directory UI and official registry listing.
- `app/api/registry/sync/route.js` — protected, paginated registry importer.
- `app/api/custom-servers/route.js` — authenticated custom endpoint registration.
- `components/custom-mcp-form.jsx` — email-link sign-in and custom endpoint form.
- `app/auth/callback/route.js` — Supabase PKCE callback.
- `supabase/migrations/` — database schema and row-level security policies.

## Data sources and sync

The directory reads from the official MCP Registry API:

`https://registry.modelcontextprotocol.io/v0.1/servers`

The importer uses `version=latest`, follows the opaque `metadata.nextCursor` cursor, and processes up to five pages of 100 records per run. It can be called repeatedly until `hasMore` is false. Imported entries are marked `unverified`; appearing in a registry is not a security review.

## Environment variables

Set these in Vercel for Production, Preview and Development:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key.
- `SUPABASE_URL` — server-side Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only service role key. Never use a `NEXT_PUBLIC_` prefix.
- `REGISTRY_SYNC_SECRET` — long random secret used to protect the sync endpoint.
- `DRIVE_SKILLSPECTOR_URL` — private HTTPS base URL of the separately deployed SkillSpector scanner service.
- `DRIVE_SKILLSPECTOR_TOKEN` — server-only bearer token shared with the scanner container. Never expose either scanner variable with a `NEXT_PUBLIC_` prefix.

To run a sync, send:

```http
POST /api/registry/sync
Authorization: Bearer <REGISTRY_SYNC_SECRET>
```

The sync endpoint requires both server-only variables `SUPABASE_SERVICE_ROLE_KEY` and `REGISTRY_SYNC_SECRET`. Do not place either in client code or commit them to Git.

## NVIDIA SkillSpector security scanner

Skill imports are gated by NVIDIA SkillSpector. Deploy the container in `security-scanner/` separately from Vercel, behind authenticated TLS ingress, then configure `DRIVE_SKILLSPECTOR_URL` and `DRIVE_SKILLSPECTOR_TOKEN` in Vercel. The scanner uses SkillSpector 2.13.1 with static analysis (`--no-llm`); Skill content is not sent to an LLM provider. SkillSpector may send dependency coordinates to OSV.dev for vulnerability lookups.

A Skill is importable only when the scanner returns a complete `SAFE` verdict for the entire retrieved Skill folder. The inspector resolves the GitHub tree and scans every regular file in the selected folder, with a 40-file cap, 250 KB per-file cap, 1 MB total cap, and fail-closed handling for truncated trees, symlinks, and submodules. It persists a deterministic bundle hash and per-file manifest alongside the SKILL.md hash. CAUTION, DO_NOT_INSTALL, scanner errors, incomplete reports, and hash mismatches are blocked. Runtime preparation, approval requests, and tool execution currently re-check the stored SKILL.md hash. Full bundle revalidation at each runtime/approval/execution boundary remains a required follow-up before treating source changes to supporting files as fully covered.

The scanner is defense-in-depth, not an antivirus guarantee or runtime sandbox. Keep the container non-root, unprivileged, resource-limited, ephemeral, and isolated from application secrets and internal networks. See [security-scanner/README.md](security-scanner/README.md) for deployment guidance.

## Custom remote MCP

The custom endpoint form uses Supabase email-link authentication. At this stage it accepts public HTTPS Streamable HTTP endpoints without credentials. It does not execute or probe the endpoint yet. Authentication methods that require stored credentials remain disabled until the encrypted secret store and remote transport checks are implemented.

Local STDIO packages are listed as package-based servers; they are not remotely connectable until an isolated execution runtime is available.

## Security notes

- Public directory rows are read-only to anonymous and authenticated users.
- Registry writes and sync-run records are server-only.
- Custom endpoint rows are protected by owner-scoped RLS policies.
- The custom endpoint API rejects non-HTTPS URLs, embedded URL credentials, localhost and common private IPv4 ranges.
- Do not execute package install commands from registry metadata.
- Before connecting to remote endpoints, add DNS/IP resolution checks, redirect restrictions, egress controls, request timeouts and an encrypted credential vault.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Next milestones

1. Finish automated registry synchronization and schedule it.
2. Add server detail pages, source provenance and compatibility checks.
3. Implement DNS-aware SSRF protection and remote MCP initialization.
4. Add encrypted credential storage and OAuth/API-key flows.
5. Build the authenticated Streamable HTTP gateway and isolated STDIO runtime.
6. Add integration tests and deployment checks.
