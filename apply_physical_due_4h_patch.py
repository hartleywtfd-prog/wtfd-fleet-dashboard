#!/usr/bin/env python3
from pathlib import Path
import shutil, sys

ROOT = Path.cwd()

def patch_physical_due_bug(path):
    text = path.read_text(encoding="utf-8")
    start = text.find("async function previewPhysicalDue")
    end = text.find("async function previewCrewEmails", start)
    if start < 0 or end < 0:
        raise RuntimeError(f"Could not locate previewPhysicalDue block in {path}")
    block = text[start:end]
    bad = "      turnoutItems: turnoutItemRows.length,\n"
    if bad not in block:
        raise RuntimeError(f"Expected physical-due bug line not found in {path}")
    block = block.replace(bad, "", 1)
    path.write_text(text[:start] + block + text[end:], encoding="utf-8")

for rel in ["operative-preview.js", "workers/operative-preview.js"]:
    p = ROOT / rel
    if not p.exists():
        raise FileNotFoundError(f"Missing expected repository file: {rel}")
    patch_physical_due_bug(p)

overlay = Path(__file__).resolve().parent
for src_rel, dst_rel in [
    ("operative-preview-shared.js", "operative-preview-shared.js"),
    ("workers/operative-preview-shared.js", "workers/operative-preview-shared.js"),
    ("apps-script/DueForPhysicalApi.gs", "apps-script/DueForPhysicalApi.gs"),
    ("wrangler-operative-preview.jsonc", "wrangler-operative-preview.jsonc"),
    ("BUILD_PHYSICAL_DUE_4_HOURS.md", "BUILD_PHYSICAL_DUE_4_HOURS.md"),
]:
    src = overlay / src_rel
    dst = ROOT / dst_rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

print("Physical-due 4-hour shared-snapshot patch applied successfully.")
print("Changed both operative-preview.js copies, Apps Script trigger, Worker wrapper, and wrangler main.")
