import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="DRIVE Skill Security Scanner", version="1.0.0")
TOKEN = os.environ.get("DRIVE_SCANNER_TOKEN", "")
MAX_BYTES = 250_000
SCAN_TIMEOUT = 90


class ScanRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_BYTES)
    filename: str = Field(default="SKILL.md", pattern=r"^[A-Za-z0-9_.-]{1,80}$")


@app.get("/health")
def health():
    return {"status": "ok", "scanner": "NVIDIA SkillSpector", "version": "2.13.1"}


@app.post("/scan")
def scan(payload: ScanRequest, authorization: str | None = Header(default=None)):
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    raw = payload.content.encode("utf-8")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Skill content exceeds scanner limit")

    with tempfile.TemporaryDirectory(prefix="drive-skill-scan-") as temp:
        root = Path(temp)
        target = root / payload.filename
        target.write_bytes(raw)
        try:
            result = subprocess.run(
                ["skillspector", "scan", str(target), "--format", "json", "--no-llm", "--fail-on-incomplete"],
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

        # Keep the raw report for audit, but derive the gate only from explicit scanner fields.
        summary = report if isinstance(report, dict) else {"report": report}
        safe = summary.get("safe_to_install") is True
        recommendation = str(summary.get("recommendation", "INCOMPLETE")).upper()
        complete = not bool(summary.get("incomplete", False)) and result.returncode == 0
        return {
            "scanner": "NVIDIA SkillSpector",
            "scanner_version": "2.13.1",
            "content_sha256": hashlib.sha256(raw).hexdigest(),
            "scan_mode": summary.get("scan_mode", "static_only"),
            "llm_used": False,
            "risk_score": summary.get("risk_score"),
            "severity": summary.get("severity", "UNKNOWN"),
            "recommendation": recommendation,
            "safe_to_install": bool(safe and complete and recommendation == "SAFE"),
            "complete": complete,
            "exit_code": result.returncode,
            "findings": summary.get("findings", []),
            "raw_report": summary,
        }
