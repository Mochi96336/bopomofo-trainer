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
'''import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestCanonicalJsonFirstUint32,
} from "../core/stable-id.js";
''',
'''import { stableRuntimeDigestCanonicalJson } from "../core/stable-id.js";
''',
"stable-id import",
)

once(
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
'''const NESTED_CLAUSE_FIRST_LANE_OFFSET = (0x811c9dc5 ^ 0x243f6a88) >>> 0;
const NESTED_CLAUSE_HASH_PRIME = 0x01000193;
const NESTED_CLAUSE_CANONICAL_SUFFIX = `,"version":${JSON.stringify(
  NESTED_CLAUSE_RULE_ORDER_VERSION,
)}}`;

interface NestedClauseHashPrefixStates {
  readonly candidateSubstream: number;
  readonly priority: number;
}

const NESTED_CLAUSE_HASH_PREFIX_CACHE = new Map<string, NestedClauseHashPrefixStates>();

function updateNestedClauseHashState(state: number, source: string): number {
  for (let index = 0; index < source.length; index += 1) {
    state = Math.imul(state ^ source.charCodeAt(index), NESTED_CLAUSE_HASH_PRIME) >>> 0;
  }
  return state;
}

function finalizeNestedClauseHash32Value(hash: number): number {
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function nestedClauseHashPrefixStates(ruleId: string): NestedClauseHashPrefixStates {
  const cached = NESTED_CLAUSE_HASH_PREFIX_CACHE.get(ruleId);
  if (cached !== undefined) return cached;
  const ruleIdCanonicalJson = JSON.stringify(ruleId);
  const candidateSubstream = updateNestedClauseHashState(
    NESTED_CLAUSE_FIRST_LANE_OFFSET,
    `{"purpose":"candidate-substream","ruleId":${ruleIdCanonicalJson},"ticket":`,
  );
  const priority = updateNestedClauseHashState(
    NESTED_CLAUSE_FIRST_LANE_OFFSET,
    `{"purpose":"priority","ruleId":${ruleIdCanonicalJson},"ticket":`,
  );
  const created = { candidateSubstream, priority };
  NESTED_CLAUSE_HASH_PREFIX_CACHE.set(ruleId, created);
  return created;
}

function nestedClauseKeyedFirstUint32(prefixState: number, ticket: number): number {
  let state = updateNestedClauseHashState(prefixState, String(ticket));
  state = updateNestedClauseHashState(state, NESTED_CLAUSE_CANONICAL_SUFFIX);
  return finalizeNestedClauseHash32Value(state);
}

function nestedClauseCandidateRandom(seed: number): RandomSource {
  let state = seed;
''',
"nested keyed first-lane helpers",
)

once(
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
"stable nested candidate hashing",
)

path.write_text(text)
