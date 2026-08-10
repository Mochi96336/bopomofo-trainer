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

export type ClauseKind =
  | "core-predication"
  | "marked"
  | "complex-predicate"
  | "information-structure"
  | "embedded-content";

export type ClauseConstructionFamily =
  | "core.nominal-predicate"
  | "core.adjective-predicate"
  | "core.intransitive"
  | "core.transitive"
  | "core.ditransitive"
  | "core.copular"
  | "core.existential"
  | "core.locative"
  | "marked.modal"
  | "marked.negative"
  | "marked.aspect"
  | "marked.ba"
  | "marked.bei"
  | "marked.comparative"
  | "complex.causative"
  | "complex.serial-verb"
  | "information.topic-comment"
  | "information.subject-omission"
  | "information.object-omission"
  | "embedded.subject-content"
  | "embedded.object-content"
  | "embedded.xcomp-control"
  | "embedded.quoted-content";

export interface SentenceConstructionClassification {
  readonly kind: SentenceKind;
  readonly family: SentenceConstructionFamily;
}

export interface ClauseConstructionClassification {
  readonly kind: ClauseKind;
  readonly family: ClauseConstructionFamily;
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

const CLAUSE_CLASSIFICATION_BY_RULE_ID: Readonly<Record<string, ClauseConstructionClassification>> = {
  "clause.nominal-predicate": { kind: "core-predication", family: "core.nominal-predicate" },
  "clause.adjective-predicate": { kind: "core-predication", family: "core.adjective-predicate" },
  "clause.intransitive": { kind: "core-predication", family: "core.intransitive" },
  "clause.transitive": { kind: "core-predication", family: "core.transitive" },
  "clause.ditransitive": { kind: "core-predication", family: "core.ditransitive" },
  "clause.copular": { kind: "core-predication", family: "core.copular" },
  "clause.existential": { kind: "core-predication", family: "core.existential" },
  "clause.locative": { kind: "core-predication", family: "core.locative" },

  "clause.modal": { kind: "marked", family: "marked.modal" },
  "clause.negative": { kind: "marked", family: "marked.negative" },
  "clause.aspect": { kind: "marked", family: "marked.aspect" },
  "clause.ba": { kind: "marked", family: "marked.ba" },
  "clause.bei": { kind: "marked", family: "marked.bei" },
  "clause.comparative": { kind: "marked", family: "marked.comparative" },

  "clause.causative": { kind: "complex-predicate", family: "complex.causative" },
  "clause.serial-verb": { kind: "complex-predicate", family: "complex.serial-verb" },

  "clause.topic-comment": { kind: "information-structure", family: "information.topic-comment" },
  "clause.subject-omission": {
    kind: "information-structure",
    family: "information.subject-omission",
  },
  "clause.object-omission": {
    kind: "information-structure",
    family: "information.object-omission",
  },

  "clause.subject-content": { kind: "embedded-content", family: "embedded.subject-content" },
  "clause.object-content": { kind: "embedded-content", family: "embedded.object-content" },
  "clause.xcomp-subject-control": { kind: "embedded-content", family: "embedded.xcomp-control" },
  "clause.xcomp-object-control": { kind: "embedded-content", family: "embedded.xcomp-control" },
  "clause.quoted-content": { kind: "embedded-content", family: "embedded.quoted-content" },
};

export function sentenceConstructionClassification(
  ruleId: string,
): SentenceConstructionClassification | null {
  return SENTENCE_CLASSIFICATION_BY_RULE_ID[ruleId] ?? null;
}

export function clauseConstructionClassification(
  ruleId: string,
): ClauseConstructionClassification | null {
  return CLAUSE_CLASSIFICATION_BY_RULE_ID[ruleId] ?? null;
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
    .filter((rule) => clauseConstructionClassification(rule.id) === null)
    .map((rule) => rule.id);

  const staleSentence = Object.keys(SENTENCE_CLASSIFICATION_BY_RULE_ID)
    .filter((ruleId) => !rules.some((rule) => rule.id === ruleId && rule.output === "Sentence"));
  const staleClause = Object.keys(CLAUSE_CLASSIFICATION_BY_RULE_ID)
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
  readonly clauseKinds: readonly EqualRuleTicketAuditRow[];
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
    clauseKinds: auditRows(clauseRules.map((rule) => {
      const classification = clauseConstructionClassification(rule.id)!;
      return { family: classification.kind, ruleId: rule.id };
    })),
    clauseFamilies: auditRows(clauseRules.map((rule) => {
      const classification = clauseConstructionClassification(rule.id)!;
      return { family: classification.family, ruleId: rule.id };
    })),
  };
}
