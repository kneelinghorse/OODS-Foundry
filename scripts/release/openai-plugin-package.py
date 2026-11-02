#!/usr/bin/env python3
"""Build the OpenAI plugin directory package (a ZIP with plugin.json at its root) from submissions/openai/<plugin>.

The ZIP is deterministic: members in sorted order, one fixed timestamp and fixed permissions, so the same source always
gives the same bytes. Check the result with:
  node scripts/release/directory-readiness.mjs --openai-package <zip> --url https://oods-foundry.com/mcp --hosted
Usage: python3 scripts/release/openai-plugin-package.py <out-dir> [plugin-name]
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
out_dir = Path(sys.argv[1]).resolve()
name = sys.argv[2] if len(sys.argv) > 2 else "oods-foundry"
source = root / "submissions/openai" / name
manifest = json.loads((source / "plugin.json").read_text())
assert manifest["name"] == name, "plugin.json name must match its folder"
members = sorted(path for path in source.rglob("*") if path.is_file() and path.name != ".DS_Store")
out_dir.mkdir(parents=True, exist_ok=True)
target = out_dir / f"{name}-openai-{manifest['version']}.zip"
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in members:
        info = zipfile.ZipInfo(path.relative_to(source).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
        info.external_attr = 0o644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, path.read_bytes())
digest = lambda data: hashlib.sha256(data).hexdigest()
receipt = {
    "builderSelfCertified": False,
    "package": target.name,
    "version": manifest["version"],
    "sha256": digest(target.read_bytes()),
    "bytes": target.stat().st_size,
    "members": [{"path": path.relative_to(source).as_posix(), "sha256": digest(path.read_bytes())} for path in members],
}
(out_dir / f"{target.stem}.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"package": str(target.relative_to(root)), "sha256": receipt["sha256"], "members": len(members)}))
