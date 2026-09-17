from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old = '''  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
    ? eligibleRules.map((rule) => ({
        rule,
        random: rule.id === "ba-predicate.attested" ? random : DETERMINISTIC_MINIMUM_RANDOM,
      }))
    : stableNestedClause
      ? stableNestedClauseCandidates(eligibleRules, random)
      : shuffled(eligibleRules, random).map((rule) => ({ rule, random }));
  for (const candidate of candidates) {
    const { rule } = candidate;
    const candidateRandom = candidate.random;
'''

new = '''  const ordinaryCandidates = !orderedLicensingAlternatives && !stableNestedClause
    ? shuffled(eligibleRules, random)
    : undefined;
  const specialCandidates: readonly NestedClauseCandidate[] | undefined = ordinaryCandidates === undefined
    ? orderedLicensingAlternatives
      ? eligibleRules.map((rule) => ({
          rule,
          random: rule.id === "ba-predicate.attested" ? random : DETERMINISTIC_MINIMUM_RANDOM,
        }))
      : stableNestedClauseCandidates(eligibleRules, random)
    : undefined;
  const candidateCount = ordinaryCandidates?.length ?? specialCandidates?.length ?? 0;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    let rule: ProductionRule;
    let candidateRandom: RandomSource;
    if (ordinaryCandidates !== undefined) {
      rule = ordinaryCandidates[candidateIndex]!;
      candidateRandom = random;
    } else {
      const candidate = specialCandidates![candidateIndex]!;
      rule = candidate.rule;
      candidateRandom = candidate.random;
    }
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one candidate construction loop, found {count}")
path.write_text(text.replace(old, new))
