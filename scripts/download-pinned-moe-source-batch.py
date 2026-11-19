#!/usr/bin/env python3
"""Download only the two pinned 2026-09-29 MOE dictionary ZIPs for temporary CI use.

No archive or dictionary definitions are committed or uploaded. The official
download URLs are resolved from the current MOE public licensing page and
checked against the previously committed exact SHA-256 source pins. A source
version change fails closed rather than silently switching editions.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN_PATH = ROOT / "data/readings/moe-20260929-sense-source-pins.json"
OFFICIAL = "https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/download/"
NAMES = {
    "concised": "dict_concised_2014_20260929.zip",
    "revised": "dict_revised_2015_20260929.zip",
}


def download_pinned(name: str, dest: Path, expected_sha: str) -> dict[str, object]:
    if name not in NAMES:
        raise ValueError("unrecognized pinned MOE source")
    url = OFFICIAL + NAMES[name]
    if len(expected_sha) != 64 or any(c not in "0123456789abcdef" for c in expected_sha):
        raise ValueError("invalid pinned MOE SHA-256")
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_suffix(".download")
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            hasher = hashlib.sha256()
            total = 0
            request = urllib.request.Request(
                url, headers={"User-Agent": "bopomofo-trainer-source-audit/1.0"}
            )
            with urllib.request.urlopen(request, timeout=65) as response, temp.open("wb") as output:
                if response.status != 200:
                    raise RuntimeError(f"official HTTP status {response.status}")
                while part := response.read(1024 * 1024):
                    hasher.update(part)
                    total += len(part)
                    output.write(part)
            actual = hasher.hexdigest()
            if actual != expected_sha:
                raise ValueError(
                    f"MOE {name} source archive pin mismatch: "
                    f"expected {expected_sha}, got {actual}"
                )
            temp.replace(dest)
            return {
                "dictionary": name,
                "url": url,
                "bytes": total,
                "sha256": actual,
                "edition": "20260929",
            }
        except ValueError:
            temp.unlink(missing_ok=True)
            raise
        except (OSError, RuntimeError) as error:
            last_error = error
            temp.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(attempt * 2)
    raise RuntimeError(f"official MOE download failed after three tries: {name}") from last_error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    pins = json.loads(PIN_PATH.read_text("utf-8"))
    if pins.get("schemaVersion") != "moe-sense-source-pins-v1" or pins.get("edition") != "20260929":
        raise RuntimeError("official source pin manifest has unexpected version")
    records = []
    for name in ("concised", "revised"):
        records.append(download_pinned(
            name, args.output_dir / NAMES[name], pins["sources"][name]["archiveSha256"]
        ))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = {"schemaVersion": "moe-pinned-archive-download-v1", "sources": records}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print("PINNED_MOE_DOWNLOAD_JSON " + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
