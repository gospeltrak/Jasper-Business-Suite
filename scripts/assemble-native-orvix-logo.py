#!/usr/bin/env python3
"""Reconstruct exact selected Orvix beta logo from checked-in data chunks.

GitHub API binary upload can be unreliable; each base64 chunk is verified
against its original git-blob SHA, and decoded PNG is verified by SHA256.
Fail closed rather than ship a corrupted Android logo.
This asset belongs ONLY to the native QA build, never alters live tenant data.
"""
from __future__ import annotations
import base64
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [ROOT / "scripts" / "assets" / f"orvix-logo.{i:02}.b64" for i in range(1, 5)]
CHUNK_SHA256 = (
    "0068e28f8884c021",
    "11b5a5d4e7e71d92",
    "c1e99a081e77dadc",
    "fabf29e43c9cce26",
)
EXPECTED_IMAGE_SHA256 = "bc1e519a44f31c1e6f463a5f0e3dfaa682466c355888d4fdc46b7cb0d4b9a607"
TARGET = ROOT / "public" / "brand" / "orvix-qa-logo.png"

parts: list[str] = []
for file, expected in zip(SOURCES, CHUNK_SHA256, strict=True):
    part = file.read_text(encoding="ascii").strip()
    if hashlib.sha256(part.encode("ascii")).hexdigest()[:16] != expected:
        raise RuntimeError(f"Orvix source chunk integrity mismatch: {file.name}")
    parts.append(part)

encoded = "".join(parts)
if len(encoded) != 8260:
    raise RuntimeError(f"Expected 8260 base64 characters, received {len(encoded)}")

png = base64.b64decode(encoded, validate=True)
if len(png) != 6193 or not png.startswith(b"\\x89PNG\\r\\n\\x1a\\n"):
    raise RuntimeError("Not a complete transparent Orvix PNG")
if hashlib.sha256(png).hexdigest() != EXPECTED_IMAGE_SHA256:
    raise RuntimeError("Orvix PNG differs from the user-selected transparent logo")

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_bytes(png)
print(f"Orvix exact beta logo verified ({len(png)} bytes, transparent PNG)")
