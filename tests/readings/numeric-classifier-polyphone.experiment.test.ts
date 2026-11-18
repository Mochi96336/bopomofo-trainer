import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../../src/syntax/realize.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import {
  REVIEWED_NUMERIC_CLASSIFIER_READINGS,
  numericClassifierContext,
  reviewedNumericClassifierReadingEligible,
} from "../../src/readings/numeric-classifier-reading.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../../src/product/session.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

type Gate = (entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: StructuralLexicalSlot,
  previousEntry: CatalogEntry | null) => boolean;
const entryById = new Map(PRACTICE_CATALOG.map(entry => [entry.id, entry]));
const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const number = PRACTICE_CATALOG.find(entry => entry.prompt.text === "五");
const ordinaryPrevious = PRACTICE_CATALOG.find(entry => entry.prompt.text === "生命");

function nounSlot(classifier: boolean): StructuralLexicalSlot {
  return {
    kind: "lexical-slot", id: "experiment:numeric-classifier",
    constituentKey: "target", occurrenceIndex: 0, allowedUpos: ["NOUN"],
    requiredFunctions: classifier ? ["classifier"] : [],
    requiredValencyFrames: [], requiredFeatures: {},
  };
}

function licensedFrontier(
  slot: StructuralLexicalSlot,
  preceding: CatalogEntry | null,
  targetWord: string,
  addClassifierGate: boolean,
) {
  const allGates: readonly Gate[] = [
    PRODUCT_READING_POLICY.readingEligibility,
    PRODUCT_READING_POLICY.preDrawReadingEligibility,
    PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
    PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
    ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
    ...(addClassifierGate ? [reviewedNumericClassifierReadingEligible] : []),
  ];
  const licensed = compatibleProfilesForSlot(slot, index).filter(profile => {
    const entry = entryById.get(profile.entryId)!;
    return entry.prompt.text === targetWord
      && allGates.every(gate => gate(entry, profile, slot, preceding));
  });
  return PRODUCT_READING_POLICY.readingFrontierFilter(licensed, entryById);
}

function targetOccurrences(utterance: ReturnType<typeof createProductState>["round"]["selection"]["utterance"]) {
  const targetSet = new Set(REVIEWED_NUMERIC_CLASSIFIER_READINGS.values());
  const byWord: Record<string, number> = {};
  const profileById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
  for (let i = 0; i < utterance.entries.length; i++) {
    const entry = utterance.entries[i]!;
    if (!targetSet.has(entry.id)) continue;
    const profile = profileById.get(utterance.syntaxProfileIds?.[i] ?? "");
    if (profile?.upos !== "NOUN") continue;
    const previousText = utterance.entries[i-1]?.prompt.text ?? null;
    const key = entry.prompt.text + "/" + entry.id + "/preceded-by-" + (previousText ?? "none");
    byWord[key] = (byWord[key] ?? 0) + 1;
  }
  return byWord;
}

describe("numeric classifier polyphone rescue: new experimental source-gated policy", () => {
  it("recovers exactly six reading identities in documented numeric classifier contexts, and nowhere else", () => {
    expect(number).toBeDefined();
    expect(ordinaryPrevious).toBeDefined();
    const positive = nounSlot(true);
    const negative = nounSlot(false);
    const rows = [];
    for (const [word, expectedReading] of REVIEWED_NUMERIC_CLASSIFIER_READINGS) {
      const before = licensedFrontier(positive, number!, word, false);
      const after = licensedFrontier(positive, number!, word, true);
      const actualIds = after.map(profile => profile.entryId);
      expect(before, word + " must have actually been blocked").toHaveLength(0);
      expect(actualIds, word + " newly licensed reading").toEqual([expectedReading]);
      expect(licensedFrontier(negative, number!, word, true)).toEqual(
        licensedFrontier(negative, number!, word, false));
      expect(licensedFrontier(positive, ordinaryPrevious!, word, true)).toEqual(
        licensedFrontier(positive, ordinaryPrevious!, word, false));
      expect(licensedFrontier(positive, null, word, true)).toEqual(
        licensedFrontier(positive, null, word, false));
      const saved = entryById.get(expectedReading)!;
      expect(numericClassifierContext(saved, after[0]!, positive, number!)).toBe(true);
      rows.push({word, readingId: expectedReading, baseline: before.length, restored: after.length});
    }
    expect(rows).toHaveLength(6);
    // MOE lists both xíng and háng as classifier readings for 行, so do not make up a singleton.
    // The new policy must not unlock this unresolved word/UPOS group.
    expect(licensedFrontier(positive, number!, "行", true)).toEqual(
      licensedFrontier(positive, number!, "行", false));
    console.log("NEW_NUMERIC_CLASSIFIER_FRONTIER_JSON " + JSON.stringify(rows));
  });

  it("runs 512 paired fresh real-product sentences under only this six-reading extra gate", () => {
    const mutable = PRODUCT_READING_POLICY as unknown as { readingEligibility: Gate };
    const original = mutable.readingEligibility;
    const scenarios = [];
    try {
      for (const scope of ["all", "tier1"] as const) {
        const whole = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
        const catalogs = scope === "all" ? whole
          : catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [1]);
        const environment = createProductEnvironment(catalogs);
        const counts = {
          baseline: {forms:new Set<string>(), selected:0, occurrences:0, target:{} as Record<string,number>},
          pilot: {forms:new Set<string>(), selected:0, occurrences:0, target:{} as Record<string,number>},
        };
        let changed = 0;
        let newlyRejectedProfiles = 0;
        for (let seed = 0; seed < 512; seed++) {
          const run = (arm: "baseline" | "pilot") => {
            mutable.readingEligibility = (entry, profile, slot, previous) => {
              const accepted = original(entry, profile, slot, previous);
              if (!accepted || arm === "baseline") return accepted;
              const result = reviewedNumericClassifierReadingEligible(entry, profile, slot, previous);
              if (!result) newlyRejectedProfiles++;
              return result;
            };
            const progress = createFreshProgressForEnvironment(
              environment, "numeric-classifier-polyphone:paired:" + scope + ":" + seed,
              "guided", "standard");
            const utterance = createProductState(environment, progress, 0).round.selection.utterance;
            const count = counts[arm];
            for (const entry of utterance.entries) count.forms.add(entry.prompt.text);
            count.occurrences += utterance.entries.length;
            const found = targetOccurrences(utterance);
            for (const [key, num] of Object.entries(found)) {
              count.target[key] = (count.target[key] ?? 0) + num;
            }
            count.selected++;
            return JSON.stringify([
              utterance.entries.map(entry => entry.id), utterance.syntaxProfileIds,
            ]);
          };
          const baseline = run("baseline");
          const pilot = run("pilot");
          if (baseline !== pilot) changed++;
        }
        scenarios.push({
          scope, pairedFreshRounds: 512, changedRounds: changed, newlyRejectedProfiles,
          baseline:{distinctDeliveredForms:counts.baseline.forms.size,
            lexicalOccurrences:counts.baseline.occurrences,target:counts.baseline.target},
          pilot:{distinctDeliveredForms:counts.pilot.forms.size,
            lexicalOccurrences:counts.pilot.occurrences,target:counts.pilot.target},
        });
      }
    } finally {
      mutable.readingEligibility = original;
    }
    expect(scenarios).toHaveLength(2);
    console.log("NEW_NUMERIC_CLASSIFIER_DELIVERY_JSON " + JSON.stringify(scenarios));
  }, 240_000);
});
