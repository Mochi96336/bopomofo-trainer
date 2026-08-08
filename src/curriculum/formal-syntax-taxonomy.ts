import type { ProductionRule, SyntaxCategory } from "../syntax/types.js";

/**
 * Product-facing taxonomy for formal syntax sampling.
 *
 * This intentionally lives outside src/syntax: grammar rules describe legality,
 * while this registry classifies legal productions for curriculum policy and
 * distribution auditing. Adding or splitting a grammar production must not
 * silently create additional product sampling mass.
 */
export type SentenceKind = "statement" | "question" | "request" | "exclamative";

export type SentenceConstructionFamily =
  | "statement.declarative"
  | "statement.complex"
  | "question.polar"
  | "question.a-not-a"
  | "question.alternative"
  | "question.constituent"
  | "request"
  | "exclamative";

export type ClauseConstructionFamily =
  | "core-predication"
  | "marked"
  | "complex-predicate"
  | "information-structure";

export interface SentenceConstructionClassification {
  readonly kind: SentenceKind;
  readonly family: SentenceConstructionFamily;
}

const SENTENCE_CLASSIFICATION_BY_RULE_ID: Readonly<Record<string, SentenceConstructionClassification>> = {
  "sentence.declarative": { kind: "statement", family: "statement.declarative" },
  "sentence.complex": { kind: "statement", family: "statement.complex" },
  "sentence.polar-question": { kind: "question", family: "question.polar" },
  "sentence.a-not-a-question": { kind: "question", family: "question.a-not-a" },
  "sentence.a-not-a-transitive-question": { kind: "question", family: "question.a-not-a" },
  "sentence.alternative-question": { kind: "question", family: "question.alternative" },
  "sentence.constituent-question": { kind: "question", family: "question.constituent" },
  "sentence.constituent-subject-question": { kind: "question", family: "question.constituent" },
  "sentence.request": { kind: "request", family: "request" },
  "sentence.exclamative": { kind: "exclamative", family: "exclamative" },
};

const CLAUSE_FAMILY_BY_RULE_ID: Readonly<Record<string, ClauseConstructionFamily>> = {
  "clause.nominal-predicate": "core-predication",
  "clause.adjective-predicate": "core-predication",
  "clause.intransitive": "core-predication",
  "clause.transitive": "core-predication",
  "clause.ditransitive": "core-predication",
  "clause.copular": "core-predication",
  "clause.existential": "core-predication",
  "clause.locative": "core-predication",

  "clause.modal": "marked",
  "clause.negative": "marked",
  "clause.aspect": "marked",
  "clause.ba": "marked",
  "clause.bei": "marked",
  "clause.comparative": "marked",

  "clause.causative": "complex-predicate",
  "clause.pivotal": "complex-predicate",
  "clause.serial-verb": "complex-predicate",

  "clause.topic-comment": "information-structure",
  "clause.subject-omission": "information-structure",
  "clause.object-omission": "information-structure",
};

export function sentenceConstructionClassification(
  ruleId: string,
): SentenceConstructionClassification | null {
  return SENTENCE_CLASSIFICATION_BY_RULE_ID[ruleId] ?? null;
}

export function clauseConstructionFamily(ruleId: string): ClauseConstructionFamily | null {
  return CLAUSE_FAMILY_BY_RULE_ID[ruleId] ?? null;
}

function controlledRules(
  rules: readonly ProductionRule[],
  category: Extract<SyntaxCategory, "Sentence" | "Clause">,
): readonly ProductionRule[] {
  return rules.filter((rule) => rule.output === category);
}

export function assertFormalSyntaxSamplingTaxonomyCoverage(
  rules: readonly ProductionRule[],
): void {
  const missingSentence = controlledRules(rules, "Sentence")
    .filter((rule) => sentenceConstructionClassification(rule.id) === null)
    .map((rule) => rule.id);
  const missingClause = controlledRules(rules, "Clause")
    .filter((rule) => clauseConstructionFamily(rule.id) === null)
    .map((rule) => rule.id);

  const staleSentence = Object.keys(SENTENCE_CLASSIFICATION_BY_RULE_ID)
    .filter((ruleId) => !rules.some((rule) => rule.id === ruleId && rule.output === "Sentence"));
  const staleClause = Object.keys(CLAUSE_FAMILY_BY_RULE_ID)
    .filter((ruleId) => !rules.some((rule) => rule.id === ruleId && rule.output === "Clause"));

  const problems = [
    missingSentence.length === 0 ? null : `unclassified Sentence rules: ${missingSentence.join(", ")}`,
    missingClause.length === 0 ? null : `unclassified Clause rules: ${missingClause.join(", ")}`,
    staleSentence.length === 0 ? null : `stale Sentence taxonomy entries: ${staleSentence.join(", ")}`,
    staleClause.length === 0 ? null : `stale Clause taxonomy entries: ${staleClause.join(", ")}`,
  ].filter((problem): problem is string => problem !== null);

  if (problems.length > 0) {
    throw new Error(`formal syntax sampling taxonomy mismatch: ${problems.join("; ")}`);
  }
}

export interface EqualRuleTicketAuditRow {
  readonly family: string;
  readonly productionRuleIds: readonly string[];
  readonly ticketCount: number;
  readonly rawShare: number;
}

function auditRows(
  entries: readonly { readonly family: string; readonly ruleId: string }[],
): readonly EqualRuleTicketAuditRow[] {
  const byFamily = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = byFamily.get(entry.family) ?? [];
    ids.push(entry.ruleId);
    byFamily.set(entry.family, ids);
  }
  const total = entries.length;
  return [...byFamily.entries()]
    .map(([family, productionRuleIds]) => ({
      family,
      productionRuleIds: [...productionRuleIds].sort(),
      ticketCount: productionRuleIds.length,
      rawShare: total === 0 ? 0 : productionRuleIds.length / total,
    }))
    .sort((left, right) => left.family.localeCompare(right.family));
}

/**
 * Audit the probability implied by the current sampler when every reachable
 * production under a category acts like one equal ticket. This is diagnostic
 * only; it must never be used as the future sampling policy.
 */
export function auditEqualRuleTicketDistribution(
  rules: readonly ProductionRule[],
): {
  readonly sentenceKinds: readonly EqualRuleTicketAuditRow[];
  readonly sentenceFamilies: readonly EqualRuleTicketAuditRow[];
  readonly clauseFamilies: readonly EqualRuleTicketAuditRow[];
} {
  assertFormalSyntaxSamplingTaxonomyCoverage(rules);
  const sentenceRules = controlledRules(rules, "Sentence");
  const clauseRules = controlledRules(rules, "Clause");

  return {
    sentenceKinds: auditRows(sentenceRules.map((rule) => {
      const classification = sentenceConstructionClassification(rule.id)!;
      return { family: classification.kind, ruleId: rule.id };
    })),
    sentenceFamilies: auditRows(sentenceRules.map((rule) => {
      const classification = sentenceConstructionClassification(rule.id)!;
      return { family: classification.family, ruleId: rule.id };
    })),
    clauseFamilies: auditRows(clauseRules.map((rule) => ({
      family: clauseConstructionFamily(rule.id)!,
      ruleId: rule.id,
    }))),
  };
}
