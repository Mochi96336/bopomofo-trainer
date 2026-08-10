from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one fragment: {old[:90]!r}")
    write(path, text.replace(old, new, 1))


# Keep the first conservative compaction: only equivalent selector/declaration
# rewrites; no geometry values change.
frame = "src/app/analysis-v2-frame-width.css"
replace_once(
    frame,
    '''    --analysis-key-height: clamp(\n      23px,\n      min(3.7vw, max(35px, min(1.94vw, 2.76dvh))),\n      48px\n    );\n    --analysis-key-gap: clamp(\n      3px,\n      min(0.55vw, max(6px, min(0.332vw, 0.474dvh))),\n      9px\n    );\n    --analysis-key-font: clamp(\n      7px,\n      min(0.85vw, max(10px, min(0.553vw, 0.789dvh))),\n      14px\n    );\n    --analysis-key-perspective: clamp(520px, min(28.74vw, 41.05dvh), 720px);\n''',
    "",
)
for old, new in [
    ("transform: perspective(var(--analysis-key-perspective)) rotateX(19deg);",
     "transform: perspective(clamp(520px, min(28.74vw, 41.05dvh), 720px)) rotateX(19deg);"),
    ("gap: var(--analysis-key-gap);",
     "gap: clamp(3px, min(0.55vw, max(6px, min(0.332vw, 0.474dvh))), 9px);"),
    ("height: var(--analysis-key-height);",
     "height: clamp(23px, min(3.7vw, max(35px, min(1.94vw, 2.76dvh))), 48px);"),
    ("font-size: var(--analysis-key-font);",
     "font-size: clamp(7px, min(0.85vw, max(10px, min(0.553vw, 0.789dvh))), 14px);"),
]:
    replace_once(frame, old, new)

viewport = "src/app/analysis-v2-viewport-composition.css"
replacements = [
    ('''.analysis-v2 .analysis-v2-speed-field,\n  .analysis-v2 .analysis-v2-semantic-domain,\n  .analysis-v2 .analysis-v2-strategy-domain {\n    padding-bottom: 0;\n  }''',
     '''.analysis-v2 :is(.analysis-v2-speed-field, .analysis-v2-semantic-domain, .analysis-v2-strategy-domain) {\n    padding-bottom: 0;\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-stage,\n  .analysis-v2 .analysis-v2-speed-primary,\n  .analysis-v2 .analysis-v2-semantic-stage,\n  .analysis-v2 .analysis-v2-semantic-primary,\n  .analysis-v2 .analysis-v2-strategy-stage {\n    min-height: 0;\n  }''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-stage,\n    .analysis-v2-speed-primary,\n    .analysis-v2-semantic-stage,\n    .analysis-v2-semantic-primary,\n    .analysis-v2-strategy-stage\n  ) {\n    min-height: 0;\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-primary .analysis-v2-primary-object-slot,\n  .analysis-v2 .analysis-v2-semantic-primary .analysis-v2-primary-object-slot,\n  .analysis-v2 .analysis-v2-strategy-stage .analysis-v2-primary-object-slot {''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-primary,\n    .analysis-v2-semantic-primary,\n    .analysis-v2-strategy-stage\n  ) .analysis-v2-primary-object-slot {'''),
    ('''    position: fixed;\n    z-index: 5;\n    left: calc(50vw - var(--analysis-board-width) / 2);\n    bottom: clamp(30px, 4dvh, 48px);\n    width: 126px;\n    transform: none;''',
     '''    position: fixed;\n    left: calc(50vw - var(--analysis-board-width) / 2);\n    bottom: clamp(30px, 4dvh, 48px);'''),
    ('''.analysis-v2 .analysis-v2-speed-field > .analysis-v2-method,\n  .analysis-v2 .analysis-v2-semantic-domain > .analysis-v2-method,\n  .analysis-v2 .analysis-v2-strategy-domain > .analysis-v2-method {\n    right: calc((100vw - var(--analysis-board-width)) / 2);\n  }''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-field,\n    .analysis-v2-semantic-domain,\n    .analysis-v2-strategy-domain\n  ) > .analysis-v2-method {\n    right: calc((100vw - var(--analysis-board-width)) / 2);\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-field,\n  .analysis-v2 .analysis-v2-semantic-domain,\n  .analysis-v2 .analysis-v2-strategy-domain {\n    padding-bottom: 30px;\n  }''',
     '''.analysis-v2 :is(.analysis-v2-speed-field, .analysis-v2-semantic-domain, .analysis-v2-strategy-domain) {\n    padding-bottom: 30px;\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-primary,\n  .analysis-v2 .analysis-v2-semantic-primary,\n  .analysis-v2 .analysis-v2-strategy-stage {\n    min-height: var(--analysis-primary-stage-height);\n  }''',
     '''.analysis-v2 :is(.analysis-v2-speed-primary, .analysis-v2-semantic-primary, .analysis-v2-strategy-stage) {\n    min-height: var(--analysis-primary-stage-height);\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-primary .analysis-v2-primary-object-slot,\n  .analysis-v2 .analysis-v2-semantic-primary .analysis-v2-primary-object-slot,\n  .analysis-v2 .analysis-v2-strategy-stage .analysis-v2-primary-object-slot {''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-primary,\n    .analysis-v2-semantic-primary,\n    .analysis-v2-strategy-stage\n  ) .analysis-v2-primary-object-slot {'''),
    ('''    position: static;\n    width: var(--analysis-board-width);\n    transform: none;''',
     '''    position: static;\n    transform: none;'''),
    ('''    position: static;\n    width: 126px;\n    min-height: 88px;\n    margin: 12px 0 0 4px;\n    transform: none;''',
     '''    position: static;\n    min-height: 88px;\n    margin: 12px 0 0 4px;'''),
    ('''    padding-right: 0;\n    padding-left: 0;''', "    padding-inline: 0;"),
    ('''.analysis-v2 .analysis-v2-speed-readout,\n  .analysis-v2 .analysis-v2-semantic-readout,\n  .analysis-v2 .analysis-v2-strategy-readout,\n  .analysis-v2 .analysis-v2-semantic-rail {\n    margin-inline: auto;\n  }''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-readout,\n    .analysis-v2-semantic-readout,\n    .analysis-v2-strategy-readout,\n    .analysis-v2-semantic-rail\n  ) {\n    margin-inline: auto;\n  }'''),
    ('''.analysis-v2 .analysis-v2-speed-field > .analysis-v2-method,\n  .analysis-v2 .analysis-v2-semantic-domain > .analysis-v2-method,\n  .analysis-v2 .analysis-v2-strategy-domain > .analysis-v2-method {\n    width: var(--analysis-board-width);\n    justify-self: center;\n  }''',
     '''.analysis-v2 :is(\n    .analysis-v2-speed-field,\n    .analysis-v2-semantic-domain,\n    .analysis-v2-strategy-domain\n  ) > .analysis-v2-method {\n    width: var(--analysis-board-width);\n    justify-self: center;\n  }'''),
]
for old, new in replacements:
    replace_once(viewport, old, new)

# Retire CSS for markup that no longer exists in production. Refuse to remove it
# if any non-CSS source starts using one of these classes again.
dead_classes = [
    "analysis-v2-table-scroll",
    "analysis-v2-matrix",
    "analysis-v2-motor-table",
    "analysis-v2-motor-cell",
    "analysis-v2-evidence-rail",
    "analysis-v2-evidence-group",
    "analysis-v2-evidence-body",
    "analysis-v2-tone-grid",
    "analysis-v2-tone-cell",
    "analysis-v2-strategy-axis",
    "analysis-v2-strategy-field",
    "strategy-matrix",
    "analysis-v2-strategy-total",
]
production_sources = [
    p for p in Path("src").rglob("*")
    if p.is_file() and p.suffix not in {".css", ".map"}
]
for cls in dead_classes:
    users = [str(p) for p in production_sources if cls in p.read_text(encoding="utf-8", errors="ignore")]
    if users:
        raise SystemExit(f"dead CSS guard: {cls} still used by {users}")

css_path = "src/app/analysis-v2.css"
text = read(css_path)
text = text.replace(
    ".analysis-v2-key::before,\n.analysis-v2-matrix td::before {",
    ".analysis-v2-key::before {",
    1,
)
legacy_start = text.index("\n.analysis-v2-table-scroll {")
legacy_end = text.index("\n.analysis-v2-strategy-stage {", legacy_start)
text = text[:legacy_start] + "\n" + text[legacy_end:]
strategy_start = text.index("\n.analysis-v2-strategy-axis {")
strategy_end = text.index("\n.analysis-v2-empty {", strategy_start)
text = text[:strategy_start] + "\n" + text[strategy_end:]
write(css_path, text)
