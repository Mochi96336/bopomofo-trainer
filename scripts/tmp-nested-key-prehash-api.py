from pathlib import Path

stable_path = Path("src/core/stable-id.ts")
sample_path = Path("src/syntax/sample.ts")
stable = stable_path.read_text()
sample = sample_path.read_text()

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} anchor, found {count}")
    return text.replace(old, new, 1)

stable = replace_once(
    stable,
'''function hashRuntimeSourceFirst32(source: string): number {
  let hash = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[0]) >>> 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  }
  return finalizeHash32Value(hash);
}
''',
'''const RUNTIME_DIGEST_FIRST32_OFFSET = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[0]) >>> 0;

function updateRuntimeDigestFirst32(hash: number, source: string): number {
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}

export function stableRuntimeDigestSourceFirstUint32PrefixState(prefix: string): number {
  return updateRuntimeDigestFirst32(RUNTIME_DIGEST_FIRST32_OFFSET, prefix);
}

export function stableRuntimeDigestSourceFirstUint32FromPrefixState(
  prefixState: number,
  dynamicSource: string,
  suffix: string,
): number {
  let hash = updateRuntimeDigestFirst32(prefixState, dynamicSource);
  hash = updateRuntimeDigestFirst32(hash, suffix);
  return finalizeHash32Value(hash);
}

function hashRuntimeSourceFirst32(source: string): number {
  return finalizeHash32Value(
    stableRuntimeDigestSourceFirstUint32PrefixState(source),
  );
}
''',
    "stable first-lane hash helper",
)

sample = replace_once(
    sample,
'''import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestCanonicalJsonFirstUint32,
} from "../core/stable-id.js";
''',
'''import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestSourceFirstUint32FromPrefixState,
  stableRuntimeDigestSourceFirstUint32PrefixState,
} from "../core/stable-id.js";
''',
    "stable-id imports",
)

sample = replace_once(
    sample,
'''function nestedClausePriorityFirstHex(canonicalJson: string): string {
  return stableRuntimeDigestCanonicalJsonFirstUint32(canonicalJson)
    .toString(16)
    .padStart(8, "0");
}

function nestedClauseCandidateSeed(ticket: number, ruleId: string): number {
  return stableRuntimeDigestCanonicalJsonFirstUint32(
    nestedClauseKeyedCanonicalJson("candidate-substream", ticket, ruleId),
  );
}

function nestedClauseCandidateRandom(ticket: number, ruleId: string): RandomSource {
  let state = nestedClauseCandidateSeed(ticket, ruleId);
''',
'''const NESTED_CLAUSE_CANONICAL_SUFFIX = `,"version":${JSON.stringify(
  NESTED_CLAUSE_RULE_ORDER_VERSION,
)}}`;

interface NestedClauseHashPrefixStates {
  readonly candidateSubstream: number;
  readonly priority: number;
}

const NESTED_CLAUSE_HASH_PREFIX_CACHE = new Map<string, NestedClauseHashPrefixStates>();

function nestedClauseHashPrefixStates(ruleId: string): NestedClauseHashPrefixStates {
  const cached = NESTED_CLAUSE_HASH_PREFIX_CACHE.get(ruleId);
  if (cached !== undefined) return cached;
  const ruleIdCanonicalJson = JSON.stringify(ruleId);
  const created = {
    candidateSubstream: stableRuntimeDigestSourceFirstUint32PrefixState(
      `{"purpose":"candidate-substream","ruleId":${ruleIdCanonicalJson},"ticket":`,
    ),
    priority: stableRuntimeDigestSourceFirstUint32PrefixState(
      `{"purpose":"priority","ruleId":${ruleIdCanonicalJson},"ticket":`,
    ),
  };
  NESTED_CLAUSE_HASH_PREFIX_CACHE.set(ruleId, created);
  return created;
}

function nestedClauseKeyedFirstUint32(prefixState: number, ticket: number): number {
  return stableRuntimeDigestSourceFirstUint32FromPrefixState(
    prefixState,
    String(ticket),
    NESTED_CLAUSE_CANONICAL_SUFFIX,
  );
}

function nestedClauseCandidateRandom(seed: number): RandomSource {
  let state = seed;
''',
    "nested first-lane helpers",
)

sample = replace_once(
    sample,
'''  return values
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
''',
'''  return values
    .map((rule) => {
      const prefixes = nestedClauseHashPrefixStates(rule.id);
      return {
        rule,
        random: nestedClauseCandidateRandom(
          nestedClauseKeyedFirstUint32(prefixes.candidateSubstream, ticket),
        ),
        priorityFirstUint32: nestedClauseKeyedFirstUint32(prefixes.priority, ticket),
      };
    })
    .sort((left, right) => {
      if (left.priorityFirstUint32 !== right.priorityFirstUint32) {
        return left.priorityFirstUint32 < right.priorityFirstUint32 ? -1 : 1;
      }
      const priorityOrder = stableRuntimeDigestCanonicalJson(
        nestedClauseKeyedCanonicalJson("priority", ticket, left.rule.id),
      ).localeCompare(stableRuntimeDigestCanonicalJson(
        nestedClauseKeyedCanonicalJson("priority", ticket, right.rule.id),
      ));
      return priorityOrder !== 0 ? priorityOrder : left.rule.id.localeCompare(right.rule.id);
    })
''',
    "nested candidate hashing",
)

stable_path.write_text(stable)
sample_path.write_text(sample)
