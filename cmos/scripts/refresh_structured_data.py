#!/usr/bin/env python3
"""Refresh OODS structured data exports (components, traits, objects, tokens).

Outputs (defaults):
- cmos/planning/oods-components.json
- cmos/planning/oods-tokens.json
- cmos/planning/structured-data-delta-YYYY-MM-DD.md
- artifacts/structured-data/manifest.json (when --artifact-dir is provided)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Set, Tuple

import yaml
from jsonschema import validate


# Resolve paths relative to repo root (cmos/scripts/* → repo root at parents[2])
REPO_ROOT = Path(__file__).resolve().parents[2]
CMOS_ROOT = REPO_ROOT / "cmos"
OUTPUT_DIR = CMOS_ROOT / "planning"
COMPONENT_SCHEMA_PATH = OUTPUT_DIR / "component-schema.json"
DEFAULT_BASELINE_COMPONENTS_PATH = OUTPUT_DIR / "oods-components.json"
DEFAULT_BASELINE_TOKENS_PATH = OUTPUT_DIR / "oods-tokens.json"
LEGACY_BASELINE_COMPONENTS_PATH = CMOS_ROOT / "research" / "oods-components.json"
LEGACY_BASELINE_TOKENS_PATH = CMOS_ROOT / "research" / "oods-tokens.json"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "structured-data"


@dataclass
class ExtractedArtifact:
    name: str
    path: Path
    etag: str
    size_bytes: int


@dataclass
class RefreshResult:
    components: ExtractedArtifact
    tokens: ExtractedArtifact
    delta_path: Optional[Path] = None
    manifest_path: Optional[Path] = None


def iso_now() -> str:
    return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_yaml(path: Path) -> Dict[str, Any]:
    def _sanitize(value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: _sanitize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_sanitize(v) for v in value]
        return value

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return _sanitize(raw)


def normalize_trait_name(name: str) -> str:
    return name.split("/")[-1]


def count_tokens(node: Any) -> int:
    if isinstance(node, dict):
        if "$value" in node:
            return 1
        return sum(count_tokens(value) for value in node.values())
    if isinstance(node, list):
        return sum(count_tokens(value) for value in node)
    return 0


def collect_traits() -> tuple[
    List[Dict[str, Any]],
    Dict[str, Dict[str, Any]],
    Dict[str, Set[str]],
    List[Dict[str, Any]],
]:
    trait_paths: List[Path] = []
    trait_paths.extend((REPO_ROOT / "traits").glob("**/*.trait.yaml"))
    trait_paths.extend((REPO_ROOT / "domains").glob("*/traits/*.trait.yaml"))
    traits: List[Dict[str, Any]] = []
    components_index: Dict[str, Dict[str, Any]] = {}
    domain_traits: Dict[str, Set[str]] = defaultdict(set)
    trait_overlays: List[Dict[str, Any]] = []

    for path in sorted(trait_paths):
        raw = load_yaml(path)
        trait_meta = raw.get("trait") or {}
        name = trait_meta.get("name")
        if not name:
            continue
        category = trait_meta.get("category") or "uncategorized"
        tags = trait_meta.get("tags") or []
        metadata = raw.get("metadata") or {}
        view_exts = raw.get("view_extensions") or {}
        rel_path = str(path.relative_to(REPO_ROOT))

        view_extensions: List[Dict[str, Any]] = []
        contexts: Set[str] = set()

        for context, entries in view_exts.items():
            if not entries:
                continue
            contexts.add(context)
            for entry in entries:
                if not isinstance(entry, Mapping):
                    continue
                view_extensions.append(
                    {
                        "component": entry.get("component"),
                        "context": context,
                        "position": entry.get("position"),
                        "priority": entry.get("priority"),
                        "props": entry.get("props") or {},
                    }
                )
                component_name = entry.get("component")
                if not component_name:
                    continue
                comp = components_index.setdefault(
                    component_name,
                    {
                        "id": component_name,
                        "displayName": component_name,
                        "categories": set(),
                        "tags": set(),
                        "contexts": set(),
                        "regions": set(),
                        "traitUsages": [],
                        "sourceFiles": set(),
                    },
                )
                comp["categories"].add(category)
                comp["tags"].update(tags)
                comp["contexts"].add(context)
                comp["sourceFiles"].add(rel_path)
                comp["regions"].update(metadata.get("regionsUsed") or [])
                comp["traitUsages"].append(
                    {
                        "trait": name,
                        "traitCategory": category,
                        "context": context,
                        "position": entry.get("position"),
                        "priority": entry.get("priority"),
                        "props": entry.get("props") or {},
                        "source": rel_path,
                    }
                )

        domain = None
        if "domains" in path.parts:
            domain = path.parts[path.parts.index("domains") + 1]
            domain_traits[domain].add(name)

        tokens = raw.get("tokens") or {}
        if tokens:
            trait_overlays.append({"trait": name, "tokens": tokens})

        traits.append(
            {
                "name": name,
                "version": trait_meta.get("version"),
                "description": (trait_meta.get("description") or "").strip(),
                "category": category,
                "tags": tags,
                "contexts": sorted(contexts),
                "viewExtensions": view_extensions,
                "parameters": raw.get("parameters") or [],
                "schema": raw.get("schema") or {},
                "semantics": raw.get("semantics") or {},
                "tokens": tokens,
                "dependencies": raw.get("dependencies") or [],
                "metadata": metadata,
                "objects": [],
                "source": rel_path,
            }
        )

    return traits, components_index, domain_traits, trait_overlays


def collect_objects() -> tuple[List[Dict[str, Any]], Dict[str, Set[str]], Dict[str, Set[str]]]:
    object_paths: List[Path] = []
    object_paths.extend((REPO_ROOT / "objects").glob("**/*.object.yaml"))
    object_paths.extend((REPO_ROOT / "domains").glob("*/objects/*.object.yaml"))

    objects: List[Dict[str, Any]] = []
    trait_object_map: Dict[str, Set[str]] = defaultdict(set)
    domain_objects: Dict[str, Set[str]] = defaultdict(set)

    for path in sorted(object_paths):
        raw = load_yaml(path)
        obj_meta = raw.get("object") or {}
        name = obj_meta.get("name")
        if not name:
            continue
        domain = None
        if "domains" in path.parts:
            domain = path.parts[path.parts.index("domains") + 1]
            domain_objects[domain].add(name)

        trait_entries = []
        for trait in raw.get("traits") or []:
            reference = trait.get("name")
            if reference:
                trait_object_map[normalize_trait_name(reference)].add(name)
            trait_entries.append(
                {
                    "reference": reference,
                    "alias": trait.get("alias"),
                    "parameters": trait.get("parameters") or {},
                }
            )

        rel_path = str(path.relative_to(REPO_ROOT))
        schema = raw.get("schema") or {}

        objects.append(
            {
                "name": name,
                "version": obj_meta.get("version"),
                "domain": obj_meta.get("domain"),
                "description": obj_meta.get("description"),
                "tags": obj_meta.get("tags") or [],
                "traits": trait_entries,
                "fields": list(schema.keys()),
                "semantics": raw.get("semantics") or {},
                "tokens": raw.get("tokens") or {},
                "metadata": raw.get("metadata") or {},
                "source": rel_path,
            }
        )

    return objects, trait_object_map, domain_objects


def finalize_components(index: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    components: List[Dict[str, Any]] = []
    for comp in index.values():
        components.append(
            {
                "id": comp["id"],
                "displayName": comp["displayName"],
                "categories": sorted(comp["categories"]),
                "tags": sorted(comp["tags"]),
                "contexts": sorted(comp["contexts"]),
                "regions": sorted(comp["regions"]),
                "traitUsages": sorted(
                    comp["traitUsages"],
                    key=lambda entry: (entry.get("trait") or "", entry.get("context") or ""),
                ),
                "sourceFiles": sorted(comp["sourceFiles"]),
            }
        )
    return sorted(components, key=lambda item: item["id"])


def summarize_domains(domain_traits: Dict[str, Set[str]], domain_objects: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
    domains: List[Dict[str, Any]] = []
    for domain in sorted(set(domain_traits.keys()) | set(domain_objects.keys())):
        domains.append(
            {
                "name": domain,
                "objectCount": len(domain_objects.get(domain) or []),
                "objects": sorted(domain_objects.get(domain) or []),
                "traitCount": len(domain_traits.get(domain) or []),
                "traits": sorted(domain_traits.get(domain) or []),
                "source": f"domains/{domain}",
            }
        )
    return domains


def extract_patterns() -> List[Dict[str, Any]]:
    patterns_dir = REPO_ROOT / "docs" / "patterns"
    patterns: List[Dict[str, Any]] = []
    if not patterns_dir.exists():
        return patterns
    for path in sorted(patterns_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = lines[0].lstrip("# ").strip() if lines else path.stem
        summary = ""
        for line in lines[1:]:
            if line and not line.startswith("#"):
                summary = line
                break
        slug = title.lower().replace(" ", "-")
        patterns.append(
            {
                "id": slug,
                "title": title,
                "summary": summary,
                "source": str(path.relative_to(REPO_ROOT)),
            }
        )
    return patterns


def build_sample_queries(
    components: List[Dict[str, Any]],
    traits_by_name: Dict[str, Dict[str, Any]],
    trait_overlays: List[Dict[str, Any]],
) -> Dict[str, Any]:
    def slice_components(predicate) -> List[Dict[str, Any]]:
        results = []
        for component in components:
            matching = {
                usage["trait"]
                for usage in component.get("traitUsages", [])
                if predicate(component, usage)
            }
            if matching:
                results.append({"id": component["id"], "traits": sorted(matching)})
        return sorted(results, key=lambda item: item["id"])

    status_traits = {
        name
        for name, payload in traits_by_name.items()
        if any("status" in tag.lower() for tag in payload.get("tags") or [])
        or "state" in name.lower()
    }

    return {
        "formComponents": slice_components(lambda _c, u: u.get("context") == "form"),
        "statusComponents": slice_components(lambda _c, u: u.get("trait") in status_traits),
        "timelineComponents": slice_components(lambda _c, u: u.get("context") == "timeline"),
        "mobileFriendly": slice_components(
            lambda comp, _u: "card" in comp.get("contexts", []) or "inline" in comp.get("contexts", [])
        ),
        "traitOverlaySlices": [
            {
                "trait": overlay["trait"],
                "tokenCount": len(overlay.get("tokens") or {}),
                "sampleTokens": sorted((overlay.get("tokens") or {}).keys())[:3],
            }
            for overlay in trait_overlays
        ],
    }


def build_tokens_payload(trait_overlays: List[Dict[str, Any]], *, generated_at: Optional[str] = None) -> Dict[str, Any]:
    timestamp = generated_at or iso_now()
    layers = {
        "reference": load_json(REPO_ROOT / "tokens" / "base.json"),
        "theme": load_json(REPO_ROOT / "tokens" / "theme.json"),
        "system": load_json(REPO_ROOT / "tokens" / "semantic" / "system.json"),
        "component": load_json(REPO_ROOT / "tokens" / "semantic" / "components.json"),
        "view": load_json(REPO_ROOT / "tokens" / "view.json"),
    }

    maps: Dict[str, Any] = {}
    maps_dir = REPO_ROOT / "tokens" / "maps"
    for path in sorted(maps_dir.glob("*.json")):
        maps[path.stem] = load_json(path)

    token_counts = {name: count_tokens(payload) for name, payload in layers.items()}

    return {
        "generatedAt": timestamp,
        "sources": {
            "base": "tokens/base.json",
            "theme": "tokens/theme.json",
            "semantic": {
                "system": "tokens/semantic/system.json",
                "components": "tokens/semantic/components.json",
            },
            "view": "tokens/view.json",
            "maps": sorted(maps.keys()),
            "traitOverlays": len(trait_overlays),
        },
        "layers": layers,
        "maps": maps,
        "traitOverlays": trait_overlays,
        "stats": {
            "referenceTokens": token_counts.get("reference", 0),
            "themeTokens": token_counts.get("theme", 0),
            "systemTokens": token_counts.get("system", 0),
            "componentTokens": token_counts.get("component", 0),
            "viewTokens": token_counts.get("view", 0),
            "mapCount": len(maps),
            "traitOverlayCount": len(trait_overlays),
        },
    }


def render_delta(
    old_components: Dict[str, Any],
    new_components: Dict[str, Any],
    old_tokens: Dict[str, Any],
    new_tokens: Dict[str, Any],
) -> str:
    def id_set(payload: Dict[str, Any], key: str) -> Set[str]:
        ids: Set[str] = set()
        for item in payload.get(key, []):
            if not isinstance(item, Mapping):
                continue
            value = item.get("id") or item.get("name")
            if value:
                ids.add(str(value))
        return ids

    old_component_ids = id_set(old_components, "components")
    new_component_ids = id_set(new_components, "components")
    old_trait_ids = id_set(old_components, "traits")
    new_trait_ids = id_set(new_components, "traits")
    old_object_ids = id_set(old_components, "objects")
    new_object_ids = id_set(new_components, "objects")

    def fmt_delta(label: str, old: int, new: int) -> str:
        diff = new - old
        sign = "+" if diff >= 0 else "-"
        return f"- {label}: {old} -> {new} ({sign}{abs(diff)})"

    lines = []
    lines.append("# Structured Data Delta")
    lines.append(f"- Baseline: {old_components.get('generatedAt', 'unknown')}")
    lines.append(f"- Current:  {new_components.get('generatedAt', 'unknown')}")
    lines.append("")
    lines.append("## Catalogue Stats")
    lines.append(
        fmt_delta(
            "Components",
            old_components.get("stats", {}).get("componentCount", len(old_component_ids)),
            new_components.get("stats", {}).get("componentCount", len(new_component_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Traits",
            old_components.get("stats", {}).get("traitCount", len(old_trait_ids)),
            new_components.get("stats", {}).get("traitCount", len(new_trait_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Objects",
            old_components.get("stats", {}).get("objectCount", len(old_object_ids)),
            new_components.get("stats", {}).get("objectCount", len(new_object_ids)),
        )
    )
    lines.append(
        fmt_delta(
            "Domains",
            old_components.get("stats", {}).get("domainCount", 0),
            new_components.get("stats", {}).get("domainCount", 0),
        )
    )
    lines.append(
        fmt_delta(
            "Patterns",
            old_components.get("stats", {}).get("patternCount", 0),
            new_components.get("stats", {}).get("patternCount", 0),
        )
    )
    lines.append("")
    lines.append("### Added / Removed")
    added_components = sorted(new_component_ids - old_component_ids)
    removed_components = sorted(old_component_ids - new_component_ids)
    added_traits = sorted(new_trait_ids - old_trait_ids)
    removed_traits = sorted(old_trait_ids - new_trait_ids)
    added_objects = sorted(new_object_ids - old_object_ids)
    removed_objects = sorted(old_object_ids - new_object_ids)
    lines.append(f"- Added components: {', '.join(added_components) or 'none'}")
    lines.append(f"- Removed components: {', '.join(removed_components) or 'none'}")
    lines.append(f"- Added traits: {', '.join(added_traits) or 'none'}")
    lines.append(f"- Removed traits: {', '.join(removed_traits) or 'none'}")
    lines.append(f"- Added objects: {', '.join(added_objects) or 'none'}")
    lines.append(f"- Removed objects: {', '.join(removed_objects) or 'none'}")
    lines.append("")

    lines.append("## Token Stats")
    old_token_stats = old_tokens.get("stats") or {}
    new_token_stats = new_tokens.get("stats") or {}
    for label in (
        "referenceTokens",
        "themeTokens",
        "systemTokens",
        "componentTokens",
        "viewTokens",
        "traitOverlayCount",
        "mapCount",
    ):
        lines.append(fmt_delta(label, int(old_token_stats.get(label, 0)), int(new_token_stats.get(label, 0))))
    lines.append("")

    lines.append("## Sample Query Coverage")
    for key, values in (new_components.get("sampleQueries") or {}).items():
        size = len(values) if isinstance(values, Iterable) else 0
        lines.append(f"- {key}: {size} entries")

    return "\n".join(lines)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def generate_structured_payloads(*, generated_at: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    traits, components_index, domain_traits, trait_overlays = collect_traits()
    objects, trait_object_map, domain_objects = collect_objects()

    traits_by_name = {trait["name"]: trait for trait in traits}
    for trait in traits:
        trait["objects"] = sorted(trait_object_map.get(trait["name"]) or [])

    components = finalize_components(components_index)
    domains = summarize_domains(domain_traits, domain_objects)
    patterns = extract_patterns()
    sample_queries = build_sample_queries(components, traits_by_name, trait_overlays)

    timestamp = generated_at or iso_now()
    components_payload = {
        "$schema": "./component-schema.json",
        "generatedAt": timestamp,
        "stats": {
            "componentCount": len(components),
            "traitCount": len(traits),
            "objectCount": len(objects),
            "domainCount": len(domains),
            "patternCount": len(patterns),
        },
        "components": components,
        "traits": sorted(traits, key=lambda item: item["name"]),
        "objects": sorted(objects, key=lambda item: item["name"]),
        "domains": domains,
        "patterns": patterns,
        "sampleQueries": sample_queries,
    }

    schema = load_json(COMPONENT_SCHEMA_PATH)
    validate(instance=components_payload, schema=schema)

    tokens_payload = build_tokens_payload(trait_overlays, generated_at=timestamp)
    return components_payload, tokens_payload


def canonicalize_payload(payload: Dict[str, Any], *, drop_keys: Tuple[str, ...] = ("generatedAt",)) -> str:
    """Return a canonical JSON string for hashing and diffing."""
    sanitized = dict(payload)
    for key in drop_keys:
        sanitized.pop(key, None)
    return json.dumps(sanitized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_etag(payload: Dict[str, Any], *, drop_keys: Tuple[str, ...] = ("generatedAt",)) -> str:
    """Compute a stable ETag-style hash for a payload."""
    canonical = canonicalize_payload(payload, drop_keys=drop_keys)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def resolve_baseline_path(
    explicit: Optional[Path],
    *,
    default: Path,
    legacy: Path,
    fallback: Path,
) -> Path:
    """Pick a baseline path preferring explicit, then current planning output, then legacy research, else fallback."""
    if explicit:
        return Path(explicit)
    if default.exists():
        return default
    if legacy.exists():
        return legacy
    return fallback


def _relative_to_repo(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def write_versioned_artifacts(
    *,
    components_payload: Dict[str, Any],
    tokens_payload: Dict[str, Any],
    components_path: Path,
    tokens_path: Path,
    delta_path: Optional[Path],
    artifact_dir: Path,
    version_tag: Optional[str],
) -> Path:
    version = version_tag or (components_payload.get("generatedAt") or iso_now()).split("T")[0]
    artifact_dir.mkdir(parents=True, exist_ok=True)

    components_artifact = artifact_dir / f"oods-components-{version}.json"
    tokens_artifact = artifact_dir / f"oods-tokens-{version}.json"
    shutil.copy2(components_path, components_artifact)
    shutil.copy2(tokens_path, tokens_artifact)

    manifest = {
        "generatedAt": components_payload.get("generatedAt"),
        "version": version,
        "source": {
            "components": _relative_to_repo(components_path),
            "tokens": _relative_to_repo(tokens_path),
        },
        "artifacts": [
            {
                "name": "components",
                "file": components_artifact.name,
                "path": _relative_to_repo(components_artifact),
                "etag": compute_etag(components_payload),
                "sizeBytes": components_artifact.stat().st_size,
            },
            {
                "name": "tokens",
                "file": tokens_artifact.name,
                "path": _relative_to_repo(tokens_artifact),
                "etag": compute_etag(tokens_payload),
                "sizeBytes": tokens_artifact.stat().st_size,
            },
        ],
    }
    if delta_path:
        manifest["delta"] = {"file": delta_path.name, "path": _relative_to_repo(delta_path)}

    manifest_path = artifact_dir / "manifest.json"
    write_json(manifest_path, manifest)
    return manifest_path


def refresh_structured_data(
    *,
    output_dir: Path = OUTPUT_DIR,
    baseline_components_path: Optional[Path] = None,
    baseline_tokens_path: Optional[Path] = None,
    generated_at: Optional[str] = None,
    include_delta: bool = True,
    artifact_dir: Optional[Path] = None,
    version_tag: Optional[str] = None,
) -> RefreshResult:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    components_payload, tokens_payload = generate_structured_payloads(generated_at=generated_at)

    components_path = output_dir / "oods-components.json"
    tokens_path = output_dir / "oods-tokens.json"
    resolved_baseline_components = resolve_baseline_path(
        baseline_components_path,
        default=DEFAULT_BASELINE_COMPONENTS_PATH,
        legacy=LEGACY_BASELINE_COMPONENTS_PATH,
        fallback=components_path,
    )
    resolved_baseline_tokens = resolve_baseline_path(
        baseline_tokens_path,
        default=DEFAULT_BASELINE_TOKENS_PATH,
        legacy=LEGACY_BASELINE_TOKENS_PATH,
        fallback=tokens_path,
    )

    old_components = load_json(resolved_baseline_components) if resolved_baseline_components.exists() else components_payload
    old_tokens = load_json(resolved_baseline_tokens) if resolved_baseline_tokens.exists() else tokens_payload

    write_json(components_path, components_payload)
    write_json(tokens_path, tokens_payload)

    delta_path = None
    if include_delta:
        delta_report = render_delta(old_components, components_payload, old_tokens, tokens_payload)
        delta_path = output_dir / f"structured-data-delta-{components_payload['generatedAt'].split('T')[0]}.md"
        delta_path.write_text(delta_report + "\n", encoding="utf-8")

    components_artifact = ExtractedArtifact(
        name="components",
        path=components_path,
        etag=compute_etag(components_payload),
        size_bytes=components_path.stat().st_size,
    )
    tokens_artifact = ExtractedArtifact(
        name="tokens",
        path=tokens_path,
        etag=compute_etag(tokens_payload),
        size_bytes=tokens_path.stat().st_size,
    )

    manifest_path = None
    if artifact_dir:
        manifest_path = write_versioned_artifacts(
            components_payload=components_payload,
            tokens_payload=tokens_payload,
            components_path=components_path,
            tokens_path=tokens_path,
            delta_path=delta_path,
            artifact_dir=artifact_dir,
            version_tag=version_tag,
        )

    return RefreshResult(
        components=components_artifact,
        tokens=tokens_artifact,
        delta_path=delta_path,
        manifest_path=manifest_path,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh OODS structured data exports.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Directory for canonical outputs (defaults to cmos/planning).",
    )
    parser.add_argument(
        "--baseline-components",
        type=Path,
        help="Baseline components JSON for delta generation (defaults to planning output, then cmos/research if present).",
    )
    parser.add_argument(
        "--baseline-tokens",
        type=Path,
        help="Baseline tokens JSON for delta generation (defaults to planning output, then cmos/research if present).",
    )
    parser.add_argument(
        "--generated-at",
        help="Override generatedAt timestamp for reproducible builds.",
    )
    parser.add_argument(
        "--skip-delta",
        action="store_true",
        help="Skip writing delta report.",
    )
    parser.add_argument(
        "--artifact-dir",
        type=Path,
        help="Write versioned artifacts and manifest with ETags to this directory.",
    )
    parser.add_argument(
        "--version-tag",
        help="Custom tag for artifact filenames (defaults to YYYY-MM-DD from generatedAt).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = refresh_structured_data(
        output_dir=args.output_dir,
        baseline_components_path=args.baseline_components,
        baseline_tokens_path=args.baseline_tokens,
        generated_at=args.generated_at,
        include_delta=not args.skip_delta,
        artifact_dir=args.artifact_dir,
        version_tag=args.version_tag,
    )

    print("Refreshed structured data.")
    print(f"- components: {result.components.path} (etag: {result.components.etag})")
    print(f"- tokens:     {result.tokens.path} (etag: {result.tokens.etag})")
    if result.delta_path:
        print(f"- delta:      {result.delta_path}")
    if result.manifest_path:
        print(f"- manifest:   {result.manifest_path}")


if __name__ == "__main__":
    main()
