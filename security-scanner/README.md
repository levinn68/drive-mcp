# DRIVE Skill Security Scanner

Isolated service for NVIDIA SkillSpector 2.13.1. Deploy this container separately from the Next.js/Vercel app.

## Required environment
- `DRIVE_SCANNER_TOKEN`: long random bearer token shared with DRIVE server-side env only.

## Deploy
Build this directory as a Docker image and deploy it to a private container service. Put an authenticated TLS ingress in front of it. Do not expose port 8080 directly to the public internet.

Recommended runtime controls:
- non-root user (already configured)
- read-only root filesystem where supported
- no privileged mode, no host mounts, no Docker socket
- CPU/memory/PID limits and request concurrency limits
- egress limited to HTTPS OSV.dev if dependency lookups are required
- short-lived temporary workspace; no persistence
- set a request body limit at the ingress

## API
- `GET /health`
- `POST /scan` with `Authorization: Bearer <DRIVE_SCANNER_TOKEN>` and JSON `{ "content": "...", "filename": "SKILL.md" }`

Scans run with `--no-llm`: source content stays inside this scanner service, while SkillSpector can query OSV.dev for dependency vulnerability metadata. The service never executes Skill code. A clean static scan is not a sandbox or a guarantee of safety.
