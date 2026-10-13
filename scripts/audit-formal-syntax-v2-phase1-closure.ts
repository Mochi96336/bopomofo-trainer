import { readFileSync } from "node:fs";
import {
  assertFormalSyntaxSamplingTaxonomyCoverage,
} from "../src/curriculum/formal-syntax-taxonomy.js";
import {
  CURRENT_CLAUSE_RULE_V2_MIGRATION,
  RETIRED_CLAUSE_RULE_V2_DECISIONS,
} from "../src/syntax/clause-model-v2.js";
import {
  FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS,
} from "../src/syntax/formal-syntax-v2-frontiers.js";
import type {
  ActiveCatalogSyntaxProfilesArtifact,
} from "../src/syntax/runtime-profiles.js";
import {
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../src/syntax/grammar.js";
import {
  auditValencyReachability,
} from "../src/syntax/valency-reachability-audit.js";
import {
  validateGrammarBundle,
} from "../src/syntax/validate.js";

const CONTROLLER_SPECIFIC_FRAMES = new Set([
  "subject-controlled-open-complement",
  "object-controlled-open-complement",
]);

function sorted(values: Iterable<string>): readonly string[] {
  return [...values].sort();
}

function difference(left: readonly string[], right: readonly string[]): readonly string[] {
  const allowed = new Set(right);
  return left.filter((value) => !allowed.has(value));
}

const liveClauseRuleIds = sorted(
  FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Clause").map((rule) => rule.id),
);
const liveSentenceRuleIds = sorted(
  FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence").map((rule) => rule.id),
);

const legacyVerbPhraseConsumers = sorted(FORMAL_SYNTAX_RULES.flatMap((rule) => {
  if (rule.output !== "Clause" && rule.output !== "Sentence") return [];
  return rule.constituents
    .filter((constituent) => constituent.category === "VerbPhrase")
    .map((constituent) => `${rule.id}:${constituent.key}`);
}));

const registeredFrontierConsumers = sorted(
  Object.entries(FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS)
    .map(([ruleId, frontier]) => `${ruleId}:${frontier.legacyVerbPhraseConstituentKey}`),
);

const unregisteredLegacyVerbPhraseConsumers = difference(
  legacyVerbPhraseConsumers,
  registeredFrontierConsumers,
);
const missingRegisteredFrontierConsumers = difference(
  registeredFrontierConsumers,
  legacyVerbPhraseConsumers,
);

const retiredClauseRuleLeakage = sorted(
  Object.keys(RETIRED_CLAUSE_RULE_V2_DECISIONS)
    .filter((ruleId) => FORMAL_SYNTAX_RULES.some((rule) => rule.id === ruleId)),
);

const currentMigrationRuleIds = sorted(Object.keys(CURRENT_CLAUSE_RULE_V2_MIGRATION));
const missingCurrentMigrationEntries = difference(liveClauseRuleIds, currentMigrationRuleIds);
const staleCurrentMigrationEntries = difference(currentMigrationRuleIds, liveClauseRuleIds);

const controllerSpecificFrameRequirements = sorted(
  new Set(FORMAL_SYNTAX_RULES.flatMap((rule) =>
    rule.constituents.flatMap((constituent) =>
      constituent.requiredValencyFrames.filter((frame) =>
        CONTROLLER_SPECIFIC_FRAMES.has(frame))))),
);

const activeProfilesArtifact = JSON.parse(readFileSync(
  new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url),
  "utf8",
)) as ActiveCatalogSyntaxProfilesArtifact;
const valency = auditValencyReachability(
  FORMAL_SYNTAX_RULES,
  activeProfilesArtifact.profiles,
);
const grammarValidationErrors = validateGrammarBundle(
  FORMAL_SYNTAX_RULES,
  FORMAL_SYNTAX_FIXTURES,
).errors.map((error) => error.message);

let samplingTaxonomyError: string | null = null;
try {
  assertFormalSyntaxSamplingTaxonomyCoverage(FORMAL_SYNTAX_RULES);
} catch (error) {
  samplingTaxonomyError = error instanceof Error ? error.message : String(error);
}

const blockerCounts = {
  grammarValidationErrors: grammarValidationErrors.length,
  zeroSupportProductionSlots: valency.zeroSupportSlots.length,
  retiredClauseRuleLeakage: retiredClauseRuleLeakage.length,
  controllerSpecificFrameRequirements: controllerSpecificFrameRequirements.length,
  unregisteredLegacyVerbPhraseConsumers: unregisteredLegacyVerbPhraseConsumers.length,
  missingRegisteredFrontierConsumers: missingRegisteredFrontierConsumers.length,
  missingCurrentMigrationEntries: missingCurrentMigrationEntries.length,
  staleCurrentMigrationEntries: staleCurrentMigrationEntries.length,
  samplingTaxonomyErrors: samplingTaxonomyError === null ? 0 : 1,
};

const summary = {
  auditVersion: "formal-syntax-v2-phase1-closure-audit-v1",
  liveClauseRuleCount: liveClauseRuleIds.length,
  liveSentenceRuleCount: liveSentenceRuleIds.length,
  liveClauseRuleIds,
  liveSentenceRuleIds,
  evidenceBlockedFrontierIds: sorted(Object.keys(FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS)),
  evidenceBlockedFrontierContracts: Object.fromEntries(
    Object.entries(FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([ruleId, frontier]) => [ruleId, frontier.evidenceContract]),
  ),
  legacyVerbPhraseConsumers,
  registeredFrontierConsumers,
  unregisteredLegacyVerbPhraseConsumers,
  missingRegisteredFrontierConsumers,
  retiredClauseRuleLeakage,
  missingCurrentMigrationEntries,
  staleCurrentMigrationEntries,
  controllerSpecificFrameRequirements,
  zeroSupportFrames: valency.zeroSupportFrames,
  zeroSupportProductionSlots: valency.zeroSupportSlots.map((slot) =>
    `${slot.ruleId}:${slot.constituentKey}`),
  mixedSupportProductionSlots: valency.mixedSupportSlots.map((slot) =>
    `${slot.ruleId}:${slot.constituentKey}`),
  grammarValidationErrors,
  samplingTaxonomyError,
  blockerCounts,
  phase1ClosureReady: Object.values(blockerCounts).every((count) => count === 0),
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.phase1ClosureReady) {
  throw new Error(
    `Formal Syntax V2 phase-1 closure blockers remain: ${JSON.stringify(blockerCounts)}`,
  );
}
