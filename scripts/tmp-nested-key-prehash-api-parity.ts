import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { NESTED_CLAUSE_RULE_ORDER_VERSION } from "../src/syntax/sample.js";
import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestCanonicalJsonFirstUint32,
  stableRuntimeDigestSourceFirstUint32FromPrefixState,
  stableRuntimeDigestSourceFirstUint32PrefixState,
} from "../src/core/stable-id.js";

type Purpose = "candidate-substream" | "priority";

const suffix = `,"version":${JSON.stringify(NESTED_CLAUSE_RULE_ORDER_VERSION)}}`;

function canonical(purpose: Purpose, ticket: number, ruleId: string): string {
  return JSON.stringify({ purpose, ruleId, ticket, version: NESTED_CLAUSE_RULE_ORDER_VERSION });
}

function direct(purpose: Purpose, ticket: number, ruleId: string): number {
  const prefix = `{"purpose":${JSON.stringify(purpose)},"ruleId":${JSON.stringify(ruleId)},"ticket":`;
  const state = stableRuntimeDigestSourceFirstUint32PrefixState(prefix);
  return stableRuntimeDigestSourceFirstUint32FromPrefixState(state, String(ticket), suffix);
}

const tickets = [
  0, 1, 2, 9, 10, 99, 100,
  0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff,
];
let prng = 0x9e3779b9;
for (let index = 0; index < 512; index += 1) {
  prng = (Math.imul(prng, 1664525) + 1013904223) >>> 0;
  tickets.push(prng);
}

const ruleIds = [...new Set(FORMAL_SYNTAX_RULES.map((rule) => rule.id))].sort();
let checks = 0;
for (const purpose of ["candidate-substream", "priority"] as const) {
  for (const ticket of tickets) {
    for (const ruleId of ruleIds) {
      const expected = stableRuntimeDigestCanonicalJsonFirstUint32(canonical(purpose, ticket, ruleId));
      const actual = direct(purpose, ticket, ruleId);
      if (actual !== expected) {
        throw new Error(`prefix hash mismatch: ${purpose} ${ticket} ${ruleId}`);
      }
      checks += 1;
    }
  }
}

const clauseRuleIds = FORMAL_SYNTAX_RULES
  .filter((rule) => rule.output === "Clause")
  .map((rule) => rule.id);
for (const ticket of tickets.slice(0, 160)) {
  const oldOrder = [...clauseRuleIds].sort((left, right) => {
    const leftJson = canonical("priority", ticket, left);
    const rightJson = canonical("priority", ticket, right);
    const leftHex = stableRuntimeDigestCanonicalJsonFirstUint32(leftJson).toString(16).padStart(8, "0");
    const rightHex = stableRuntimeDigestCanonicalJsonFirstUint32(rightJson).toString(16).padStart(8, "0");
    const laneOrder = leftHex.localeCompare(rightHex);
    if (laneOrder !== 0) return laneOrder;
    const fullOrder = stableRuntimeDigestCanonicalJson(leftJson)
      .localeCompare(stableRuntimeDigestCanonicalJson(rightJson));
    return fullOrder !== 0 ? fullOrder : left.localeCompare(right);
  });
  const newOrder = [...clauseRuleIds].sort((left, right) => {
    const leftFirst = direct("priority", ticket, left);
    const rightFirst = direct("priority", ticket, right);
    if (leftFirst !== rightFirst) return leftFirst < rightFirst ? -1 : 1;
    const fullOrder = stableRuntimeDigestCanonicalJson(canonical("priority", ticket, left))
      .localeCompare(stableRuntimeDigestCanonicalJson(canonical("priority", ticket, right)));
    return fullOrder !== 0 ? fullOrder : left.localeCompare(right);
  });
  if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
    throw new Error(`priority ordering mismatch at ticket ${ticket}`);
  }
}

console.log(JSON.stringify({
  ruleIds: ruleIds.length,
  tickets: tickets.length,
  firstLaneChecks: checks,
  clauseRuleIds: clauseRuleIds.length,
  orderingTickets: Math.min(160, tickets.length),
}));
