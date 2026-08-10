from pathlib import Path

source_path = Path("scripts/zz_one_off_css_compact_161.py")
source = source_path.read_text(encoding="utf-8")
old_helper = '''def replace_once(path: str, old: str, new: str) -> None:\n    text = read(path)\n    if text.count(old) != 1:\n        raise SystemExit(f"{path}: expected exactly one fragment: {old[:90]!r}")\n    write(path, text.replace(old, new, 1))\n'''
new_helper = '''def replace_once(path: str, old: str, new: str) -> None:\n    text = read(path)\n    count = text.count(old)\n    if count == 0 and new in text:\n        return\n    repeated_primary_slot = old.startswith(\n        ".analysis-v2 .analysis-v2-speed-primary .analysis-v2-primary-object-slot,"\n    )\n    expected = 2 if repeated_primary_slot else 1\n    if count != expected:\n        raise SystemExit(\n            f"{path}: expected {expected} fragment(s), found {count}: {old[:90]!r}"\n        )\n    write(path, text.replace(old, new, expected))\n'''
if source.count(old_helper) != 1:
    raise SystemExit("one-off CSS helper drifted")
source = source.replace(old_helper, new_helper, 1)
exec(compile(source, str(source_path), "exec"))
