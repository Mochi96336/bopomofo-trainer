from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()
old = '''function nestedClauseKeyedCanonicalJson(
  purpose: "candidate-substream" | "priority",
  ticket: number,
  ruleId: string,
): string {
  // These keys are already in stableRuntimeDigest canonical sort order:
  // purpose, ruleId, ticket, version. Keep this byte-for-byte equivalent.
  return JSON.stringify({
    purpose,
    ruleId,
    ticket,
    version: NESTED_CLAUSE_RULE_ORDER_VERSION,
  });
}
'''
new = '''const NESTED_CLAUSE_PURPOSE_CANONICAL_JSON = {
  "candidate-substream": JSON.stringify("candidate-substream"),
  priority: JSON.stringify("priority"),
} as const;
const NESTED_CLAUSE_RULE_ORDER_VERSION_CANONICAL_JSON = JSON.stringify(
  NESTED_CLAUSE_RULE_ORDER_VERSION,
);

function nestedClauseKeyedCanonicalJson(
  purpose: "candidate-substream" | "priority",
  ticket: number,
  ruleId: string,
): string {
  // Keep the exact canonical key order while avoiding a temporary object and
  // whole-object JSON serialization. Variable strings/numbers still use
  // JSON.stringify so escaping and non-finite-number semantics stay identical.
  return `{"purpose":${NESTED_CLAUSE_PURPOSE_CANONICAL_JSON[purpose]},"ruleId":${JSON.stringify(ruleId)},"ticket":${JSON.stringify(ticket)},"version":${NESTED_CLAUSE_RULE_ORDER_VERSION_CANONICAL_JSON}}`;
}
'''
if old not in text:
    raise SystemExit("nestedClauseKeyedCanonicalJson anchor missing")
path.write_text(text.replace(old, new, 1))
