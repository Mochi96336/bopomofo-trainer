import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { NESTED_CLAUSE_RULE_ORDER_VERSION } from "../src/syntax/sample.js";
import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestCanonicalJsonFirstUint32,
} from "../src/core/stable-id.js";

type Purpose = "candidate-substream" | "priority";

const OFFSET = (0x811c9dc5 ^ 0x243f6a88) >>> 0;
const PRIME = 0x01000193;
const SUFFIX = `,"version":${JSON.stringify(NESTED_CLAUSE_RULE_ORDER_VERSION)}}`;

function update(state: number, source: string): number {
  for (let index = 0; index < source.length; index += 1) {
    state = Math.imul(state ^ source.charCodeAt(index), PRIME) >>> 0;
  }
  return state;
}

function finalize(hash: number): number {
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function prefixState(purpose: Purpose, ruleId: string): number {
  return update(
    OFFSET,
    `{"purpose":${JSON.stringify(purpose)},"ruleId":${JSON.stringify(ruleId)},"ticket":`,
  );
}

function directFirst(purpose: Purpose, ticket: number, ruleId: string): number {
  let state = prefixState(purpose, ruleId);
  state = update(state, String(ticket));
  state = update(state, SUFFIX);
  return finalize(state);
}

function canonical(purpose: Purpose, ticket: number, ruleId: string): string {
  return JSON.stringify({ purpose, ruleId, ticket, version: NESTED_CLAUSE_RULE_ORDER_VERSION });
}

const tickets = [
  0,
  1,
  2,
  9,
  10,
  99,
  100,
  0x7fffffff,
  0x80000000,
  0xfffffffe,
  0xffffffff,
];
let state = 0x9e3779b9;
for (let index = 0; index < 512; index += 1) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  tickets.push(state);
}

const ruleIds = [...new Set(FORMAL_SYNTAX_RULES.map((rule) => rule.id))].sort();
let checks = 0;
for (const purpose of ["candidate-substream", "priority"] as const) {
  for (const ticket of tickets) {
    for (const ruleId of ruleIds) {
      const expected = stableRuntimeDigestCanonicalJsonFirstUint32(canonical(purpose, ticket, ruleId));
      const actual = directFirst(purpose, ticket, ruleId);
      if (actual !== expected) {
        throw new Error(`first-lane mismatch: ${purpose} ${ticket} ${ruleId}: ${actual} !== ${expected}`);
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
    const leftFirst = directFirst("priority", ticket, left);
    const rightFirst = directFirst("priority", ticket, right);
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
