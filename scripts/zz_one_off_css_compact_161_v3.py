from pathlib import Path

source_path = Path("scripts/zz_one_off_css_compact_161.py")
source = source_path.read_text(encoding="utf-8")

old_helper = '''def replace_once(path: str, old: str, new: str) -> None:\n    text = read(path)\n    if text.count(old) != 1:\n        raise SystemExit(f"{path}: expected exactly one fragment: {old[:90]!r}")\n    write(path, text.replace(old, new, 1))\n'''
new_helper = '''def replace_once(path: str, old: str, new: str) -> None:\n    text = read(path)\n    count = text.count(old)\n    if count == 0 and new in text:\n        return\n    repeated_primary_slot = old.startswith(\n        ".analysis-v2 .analysis-v2-speed-primary .analysis-v2-primary-object-slot,"\n    )\n    expected = 2 if repeated_primary_slot else 1\n    if count != expected:\n        raise SystemExit(\n            f"{path}: expected {expected} fragment(s), found {count}: {old[:90]!r}"\n        )\n    write(path, text.replace(old, new, expected))\n'''
if source.count(old_helper) != 1:
    raise SystemExit("one-off CSS helper drifted")
source = source.replace(old_helper, new_helper, 1)

old_guard = '''production_sources = [\n    p for p in Path("src").rglob("*")\n    if p.is_file() and p.suffix not in {".css", ".map"}\n]\nfor cls in dead_classes:\n    users = [str(p) for p in production_sources if cls in p.read_text(encoding="utf-8", errors="ignore")]\n    if users:\n        raise SystemExit(f"dead CSS guard: {cls} still used by {users}")\n'''
new_guard = '''production_sources = [\n    p for p in Path("src").rglob("*")\n    if p.is_file() and p.suffix not in {".css", ".map"}\n]\n\ndef actual_class_usage(source_text: str, cls: str) -> bool:\n    # Do not confuse domain/module terminology such as "strategy-matrix.ts"\n    # with a CSS class. Only concrete markup/DOM class references count.\n    needles = (\n        f'class="{cls}',\n        f"class='{cls}",\n        f' {cls} ',\n        f' {cls}"',\n        f" {cls}'",\n        f'.{cls}',\n        f'classList.add("{cls}"',\n        f"classList.add('{cls}'",\n        f'classList.toggle("{cls}"',\n        f"classList.toggle('{cls}'",\n    )\n    return any(needle in source_text for needle in needles)\n\nfor cls in dead_classes:\n    users = []\n    for p in production_sources:\n        source_text = p.read_text(encoding="utf-8", errors="ignore")\n        if actual_class_usage(source_text, cls):\n            users.append(str(p))\n    if users:\n        raise SystemExit(f"dead CSS guard: {cls} still used as a class by {users}")\n'''
if source.count(old_guard) != 1:
    raise SystemExit("dead CSS guard block drifted")
source = source.replace(old_guard, new_guard, 1)

exec(compile(source, str(source_path), "exec"))
