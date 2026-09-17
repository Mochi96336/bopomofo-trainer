from pathlib import Path

path = Path("src/curriculum/formal-syntax-utterance.ts")
text = path.read_text()
old = '''function sameCanonicalRuleSet(
  rules: readonly ProductionRule[],
  canonicalRules: readonly ProductionRule[],
): boolean {
  if (rules.length !== canonicalRules.length) return false;
'''
new = '''function sameCanonicalRuleSet(
  rules: readonly ProductionRule[],
  canonicalRules: readonly ProductionRule[],
): boolean {
  if (rules === canonicalRules) return true;
  if (rules.length !== canonicalRules.length) return false;
'''
if old not in text:
    raise SystemExit("sameCanonicalRuleSet anchor missing")
path.write_text(text.replace(old, new, 1))
