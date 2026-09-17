from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()
old = '''  const eligibleRules = (rulesByOutput.get(category) ?? [])
    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))
    .filter((rule) => !isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId)
    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);
'''
new = '''  const eligibleRules = (rulesByOutput.get(category) ?? []).filter((rule) =>
    ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses)
      && (!isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId)
      && (requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId)
  );
'''
if old not in text:
    raise SystemExit("eligibleRules filter-chain anchor missing")
path.write_text(text.replace(old, new, 1))
