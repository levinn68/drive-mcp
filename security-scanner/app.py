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
        assessment = summary.get("risk_assessment") or {}
        metadata = summary.get("metadata") or {}
        recommendation = str(assessment.get("recommendation", "INCOMPLETE")).upper()
        # --fail-on-incomplete makes incomplete coverage a non-zero exit. SAFE is only accepted on exit 0.
        complete = result.returncode == 0 and recommendation == "SAFE" and not bool(metadata.get("incomplete", False))
        safe = complete
        return {
            "scanner": "NVIDIA SkillSpector",
            "scanner_version": "2.13.1",
            "content_sha256": hashlib.sha256(raw).hexdigest(),
            "scan_mode": summary.get("scan_mode", "static_only"),
            "llm_used": False,
            "risk_score": assessment.get("score"),
            "severity": assessment.get("severity", "UNKNOWN"),
            "recommendation": recommendation,
            "safe_to_install": bool(safe and complete and recommendation == "SAFE"),
            "complete": complete,
            "exit_code": result.returncode,
            "findings": summary.get("issues", []),
            "raw_report": summary,
        }
