from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old = '''  return values
    .map((rule) => {
      const priorityCanonicalJson = nestedClauseKeyedCanonicalJson("priority", ticket, rule.id);
      return {
        rule,
        random: nestedClauseCandidateRandom(ticket, rule.id),
        priorityCanonicalJson,
        priorityFirstHex: nestedClausePriorityFirstHex(priorityCanonicalJson),
      };
    })
    .sort((left, right) => {
      const firstLaneOrder = left.priorityFirstHex.localeCompare(right.priorityFirstHex);
      if (firstLaneOrder !== 0) return firstLaneOrder;
      const priorityOrder = stableRuntimeDigestCanonicalJson(left.priorityCanonicalJson)
        .localeCompare(stableRuntimeDigestCanonicalJson(right.priorityCanonicalJson));
      return priorityOrder !== 0 ? priorityOrder : left.rule.id.localeCompare(right.rule.id);
    })
    .map(({ rule, random: candidateRandom }) => ({ rule, random: candidateRandom }));'''

new = '''  return values
    .map((rule) => {
      const priorityCanonicalJson = nestedClauseKeyedCanonicalJson("priority", ticket, rule.id);
      return {
        rule,
        priorityCanonicalJson,
        priorityFirstHex: nestedClausePriorityFirstHex(priorityCanonicalJson),
      };
    })
    .sort((left, right) => {
      const firstLaneOrder = left.priorityFirstHex.localeCompare(right.priorityFirstHex);
      if (firstLaneOrder !== 0) return firstLaneOrder;
      const priorityOrder = stableRuntimeDigestCanonicalJson(left.priorityCanonicalJson)
        .localeCompare(stableRuntimeDigestCanonicalJson(right.priorityCanonicalJson));
      return priorityOrder !== 0 ? priorityOrder : left.rule.id.localeCompare(right.rule.id);
    })
    .map(({ rule }) => {
      let candidateRandom: RandomSource | undefined;
      return {
        rule,
        get random() {
          candidateRandom ??= nestedClauseCandidateRandom(ticket, rule.id);
          return candidateRandom;
        },
      };
    });'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one stable nested candidate body, found {count}")
path.write_text(text.replace(old, new))
