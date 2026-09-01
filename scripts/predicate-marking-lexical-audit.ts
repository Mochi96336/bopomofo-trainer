import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RandomSource } from "../src/core/model.js";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../src/app/generated/catalog.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import type { StructuralLexicalSlot } from "../src/syntax/derive.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../src/syntax/realize.js";
import { sampleStructuralDerivation } from "../src/syntax/sample.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";

class ZeroRandom implements RandomSource {
  next(): number {
    return 0;
  }
}

function requireSlot(
  slots: readonly StructuralLexicalSlot[],
  constituentKey: string,
): StructuralLexicalSlot {
  const matches = slots.filter((slot) => slot.constituentKey === constituentKey);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${constituentKey} slot, found ${matches.length}`);
  }
  return matches[0]!;
}

function uniqueTexts(
  profiles: readonly RuntimeSyntaxProfile[],
  textByEntryId: ReadonlyMap<string, string>,
): readonly string[] {
  return [...new Set(profiles.map((profile) => textByEntryId.get(profile.entryId)))].filter(
    (text): text is string => text !== undefined,
  ).sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

function functionSignatureCounts(
  profiles: readonly RuntimeSyntaxProfile[],
): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    const signature = profile.functions.join("+") || "(none)";
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function summary(
  profiles: readonly RuntimeSyntaxProfile[],
  textByEntryId: ReadonlyMap<string, string>,
) {
  return {
    profileCount: profiles.length,
    entryCount: new Set(profiles.map((profile) => profile.entryId)).size,
    texts: uniqueTexts(profiles, textByEntryId),
    functionSignatureCounts: functionSignatureCounts(profiles),
  };
}

/**
 * Compare the executable Predicate marking slots against the active runtime
 * profile set. `clause.modal` is retained only as a migration baseline: its
 * `auxiliary` requirement is measured, not endorsed as sufficient modality
 * evidence.
 */
export function auditPredicateMarkingLexicalGates() {
  const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
  const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);

  const predicateShape = sampleStructuralDerivation({
    rootCategory: "Predicate",
    rules: FORMAL_SYNTAX_RULES,
    random: new ZeroRandom(),
    maximumAttempts: 1,
    rootProductionRuleId: "predicate.verb.expanded",
    nestedProductionTargets: [
      { parentRuleId: "predicate.verb.expanded", constituentKey: "negation", exactCount: 1 },
      { parentRuleId: "predicate.verb.expanded", constituentKey: "modal", exactCount: 1 },
      { parentRuleId: "predicate.verb.expanded", constituentKey: "adverbial", exactCount: 0 },
      { parentRuleId: "predicate.verb.expanded", constituentKey: "complement", exactCount: 0 },
      { parentRuleId: "predicate.verb.expanded", constituentKey: "aspect", exactCount: 1 },
    ],
  });
  if (predicateShape === null) throw new Error("predicate.verb.expanded marking probe is unreachable");

  const legacyModalShape = sampleStructuralDerivation({
    rootCategory: "Clause",
    rules: FORMAL_SYNTAX_RULES,
    random: new ZeroRandom(),
    maximumAttempts: 1,
    rootProductionRuleId: "clause.modal",
  });
  if (legacyModalShape === null) throw new Error("legacy clause.modal probe is unreachable");

  const negationSlot = requireSlot(predicateShape.lexicalSlots, "negation");
  const predicateModalSlot = requireSlot(predicateShape.lexicalSlots, "modal");
  const aspectSlot = requireSlot(predicateShape.lexicalSlots, "aspect");
  const legacyModalSlot = requireSlot(legacyModalShape.lexicalSlots, "modal");

  const negationProfiles = compatibleProfilesForSlot(negationSlot, index);
  const predicateModalProfiles = compatibleProfilesForSlot(predicateModalSlot, index);
  const aspectProfiles = compatibleProfilesForSlot(aspectSlot, index);
  const legacyModalProfiles = compatibleProfilesForSlot(legacyModalSlot, index);

  const legacyModalProfileIds = new Set(legacyModalProfiles.map((profile) => profile.id));
  const predicateModalProfileIds = new Set(predicateModalProfiles.map((profile) => profile.id));
  const modalLeakage = predicateModalProfiles.filter(
    (profile) => !legacyModalProfileIds.has(profile.id),
  );
  const legacyMissingFromPredicate = legacyModalProfiles.filter(
    (profile) => !predicateModalProfileIds.has(profile.id),
  );

  return {
    contract: "predicate-marking-lexical-gate-audit-v1",
    predicateRuleId: "predicate.verb.expanded",
    slotRequirements: {
      negation: {
        allowedUpos: negationSlot.allowedUpos,
        requiredFunctions: negationSlot.requiredFunctions,
        requiredFeatures: negationSlot.requiredFeatures,
      },
      modal: {
        allowedUpos: predicateModalSlot.allowedUpos,
        requiredFunctions: predicateModalSlot.requiredFunctions,
        requiredFeatures: predicateModalSlot.requiredFeatures,
      },
      aspect: {
        allowedUpos: aspectSlot.allowedUpos,
        requiredFunctions: aspectSlot.requiredFunctions,
        requiredFeatures: aspectSlot.requiredFeatures,
      },
      legacyClauseModal: {
        allowedUpos: legacyModalSlot.allowedUpos,
        requiredFunctions: legacyModalSlot.requiredFunctions,
        requiredFeatures: legacyModalSlot.requiredFeatures,
      },
    },
    reachableProfiles: {
      negation: summary(negationProfiles, textByEntryId),
      predicateModalCurrent: summary(predicateModalProfiles, textByEntryId),
      legacyClauseModal: summary(legacyModalProfiles, textByEntryId),
      aspect: summary(aspectProfiles, textByEntryId),
    },
    modalComparison: {
      legacyIsSubsetOfPredicate: legacyMissingFromPredicate.length === 0,
      leakedProfileCount: modalLeakage.length,
      leakedEntryCount: new Set(modalLeakage.map((profile) => profile.entryId)).size,
      leakedTexts: uniqueTexts(modalLeakage, textByEntryId),
      leakedFunctionSignatureCounts: functionSignatureCounts(modalLeakage),
      legacyMissingProfileCount: legacyMissingFromPredicate.length,
      legacyMissingTexts: uniqueTexts(legacyMissingFromPredicate, textByEntryId),
    },
  } as const;
}

if (process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(auditPredicateMarkingLexicalGates(), null, 2));
}
