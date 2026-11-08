import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path, PurePosixPath

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="DRIVE Skill Security Scanner", version="1.1.0")
TOKEN = os.environ.get("DRIVE_SCANNER_TOKEN", "")
MAX_FILES = 40
MAX_FILE_BYTES = 250_000
MAX_BUNDLE_BYTES = 1_000_000
SCAN_TIMEOUT = 90
SAFE_PART = re.compile(r"^[A-Za-z0-9_.@+-]+$")


class BundleFile(BaseModel):
    path: str = Field(min_length=1, max_length=240)
    content: str = Field(max_length=MAX_FILE_BYTES)


class ScanRequest(BaseModel):
    files: list[BundleFile] = Field(min_length=1, max_length=MAX_FILES)


def valid_path(value: str) -> bool:
    path = PurePosixPath(value)
    return (
        not path.is_absolute()
        and "\\" not in value
        and "\0" not in value
        and all(part not in ("", ".", "..") and SAFE_PART.fullmatch(part) for part in value.split("/"))
    )


@app.get("/health")
def health():
    return {"status": "ok", "scanner": "NVIDIA SkillSpector", "version": "2.13.1", "service_version": "1.1.0"}


@app.post("/scan")
def scan(payload: ScanRequest, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    seen = set()
    total = 0
    normalized = []
    for item in payload.files:
        if not valid_path(item.path) or item.path in seen:
            raise HTTPException(status_code=400, detail="Invalid or duplicate bundle path")
        seen.add(item.path)
        raw = item.content.encode("utf-8")
        if len(raw) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"File exceeds size limit: {item.path}")
        total += len(raw)
        if total > MAX_BUNDLE_BYTES:
            raise HTTPException(status_code=413, detail="Bundle exceeds total size limit")
        normalized.append((item.path, raw))
    if not any(path.lower() == "skill.md" for path, _ in normalized):
        raise HTTPException(status_code=400, detail="Bundle must contain SKILL.md")

    normalized.sort(key=lambda item: item[0])
    digest = hashlib.sha256()
    for path, raw in normalized:
        digest.update(path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(raw)
        digest.update(b"\0")
    bundle_hash = digest.hexdigest()

    with tempfile.TemporaryDirectory(prefix="drive-skill-scan-") as temp:
        root = Path(temp) / "skill"
        root.mkdir(mode=0o700)
        for path, raw in normalized:
            target = root.joinpath(*PurePosixPath(path).parts)
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            target.write_bytes(raw)
        try:
            result = subprocess.run(
                ["skillspector", "scan", str(root), "--format", "json", "--no-llm", "--fail-on-incomplete"],
                cwd=temp,
                capture_output=True,
                text=True,
                timeout=SCAN_TIMEOUT,
                check=False,
                env={"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"), "HOME": temp, "PYTHONNOUSERSITE": "1"},
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="SkillSpector scan timed out")
        if not result.stdout.strip():
            raise HTTPException(status_code=502, detail="SkillSpector returned no report")
        try:
            report = json.loads(result.stdout)
        except json.JSONDecodeError:
            raise HTTPException(status_code=502, detail="SkillSpector returned an invalid JSON report")

        assessment = report.get("risk_assessment") or {}
        metadata = report.get("metadata") or {}
        recommendation = str(assessment.get("recommendation", "INCOMPLETE")).upper()
        complete = result.returncode == 0 and recommendation == "SAFE" and not bool(metadata.get("incomplete", False))
        return {
            "scanner": "NVIDIA SkillSpector",
            "scanner_version": "2.13.1",
            "content_sha256": bundle_hash,
            "files_scanned": len(normalized),
            "bytes_scanned": total,
            "scan_mode": "static_only",
            "llm_used": False,
            "risk_score": assessment.get("score"),
            "severity": assessment.get("severity", "UNKNOWN"),
            "recommendation": recommendation,
            "safe_to_install": bool(complete and recommendation == "SAFE"),
            "complete": complete,
            "exit_code": result.returncode,
            "findings": report.get("issues", []),
            "raw_report": report,
        }
