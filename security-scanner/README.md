# DRIVE Skill Security Scanner

Isolated FastAPI service for NVIDIA SkillSpector 2.13.1. Deploy this container separately from the Next.js/Vercel app.

## Required environment
- `DRIVE_SCANNER_TOKEN`: long random bearer token shared with DRIVE server-side env only.

## Railway deployment
1. Create a Railway project and choose **Deploy from GitHub repo**.
2. Select `levinn68/drive-mcp`.
3. Set the service root directory to `/security-scanner`.
4. Railway detects the Dockerfile in that directory. If prompted, select Dockerfile builder.
5. Add `DRIVE_SCANNER_TOKEN` as a secret variable. Generate a random 32-byte hex token; do not commit it.
6. Add a public HTTPS domain for the service. Keep the service protected by the bearer token.
7. Confirm `https://YOUR-SCANNER-DOMAIN/health` returns JSON with status `ok`.
8. In Vercel, set `DRIVE_SKILLSPECTOR_URL=https://YOUR-SCANNER-DOMAIN` and `DRIVE_SKILLSPECTOR_TOKEN` to the exact same token, then redeploy DRIVE.

## API
- `GET /health`
- `POST /scan` with `Authorization: Bearer <DRIVE_SCANNER_TOKEN>` and JSON `{ "files": [{ "path": "SKILL.md", "content": "..." }] }`.

The API accepts up to 40 files, 250 KB per file, and 1 MB total. It rejects unsafe/duplicate paths and scans a temporary directory with SkillSpector `--no-llm --fail-on-incomplete`. It never executes Skill code. Source content stays inside this scanner service, while SkillSpector may query OSV.dev for dependency vulnerability metadata.

## Runtime hardening
- non-root user (already configured)
- read-only root filesystem where supported
- no privileged mode, no host mounts, no Docker socket
- CPU/memory/PID and request concurrency limits
- egress limited to HTTPS OSV.dev where practical
- short-lived temporary workspace; no persistence
- request body limits at ingress

A clean static scan is defense-in-depth, not a sandbox or antivirus guarantee.
