from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} anchor, found {count}")
    text = text.replace(old, new, 1)

once(
    'export const NESTED_CLAUSE_RULE_ORDER_VERSION = "stable-keyed-rule-substream-v2";\n\n',
    '''export const NESTED_CLAUSE_RULE_ORDER_VERSION = "stable-keyed-rule-substream-v2";\n\nconst STABLE_NESTED_VISIT_ATTRIBUTION = {\n  calls: 0,\n  items: 0,\n  visits: 0,\n};\n\nexport function readStableNestedVisitAttribution() {\n  return { ...STABLE_NESTED_VISIT_ATTRIBUTION };\n}\n\n''',
    "stats",
)

once(
    '): readonly NestedClauseCandidate[] {\n  if (values.length === 0) return [];\n',
    '''): readonly NestedClauseCandidate[] {\n  STABLE_NESTED_VISIT_ATTRIBUTION.calls += 1;\n  STABLE_NESTED_VISIT_ATTRIBUTION.items += values.length;\n  if (values.length === 0) return [];\n''',
    "stable candidate entry",
)

once(
    '  for (const candidate of candidates) {\n    const { rule } = candidate;\n',
    '''  for (const candidate of candidates) {\n    if (stableNestedClause) STABLE_NESTED_VISIT_ATTRIBUTION.visits += 1;\n    const { rule } = candidate;\n''',
    "candidate loop",
)

path.write_text(text)
