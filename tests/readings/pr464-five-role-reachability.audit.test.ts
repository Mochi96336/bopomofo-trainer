import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import { excludeUnresolvedReadingGroups } from "../../src/readings/reading-frontier.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

/**
 * Deliberately small grammar to prove a specific licensed lexical identity can
 * be drawn. NOT a natural-language sentence validity or pronunciation oracle.
 * Uses the real compiled catalog, real syntax profiles and real production
 * reading gates, with one isolated source-supported exact role rejection.
 */
const cases = [
  { text: "都", upos: "NOUN", rejected: "word:都:ㄉㄡ1", allowed: "word:都:ㄉㄨ1" },
  { text: "說", upos: "NOUN", rejected: "word:說:ㄕㄨㄟ4", allowed: "word:說:ㄕㄨㄛ1" },
  { text: "號", upos: "NOUN", rejected: "word:號:ㄏㄠ2", allowed: "word:號:ㄏㄠ4" },
  { text: "了", upos: "VERB", rejected: "word:了:ㄌㄜ5", allowed: "word:了:ㄌㄧㄠ3" },
  { text: "給", upos: "ADP", rejected: "word:給:ㄐㄧ3", allowed: "word:給:ㄍㄟ3" },
] as const satisfies readonly { text: string; upos: Upos; rejected: string; allowed: string }[];

const entryById = new Map(PRACTICE_CATALOG.map(e => [e.id, e]));
const pronoun = PRACTICE_CATALOG.find(e => e.id === "word:我:ㄨㄛ3");
const pronounProfile = SYNTAX_PROFILES.find(
  p => p.entryId === pronoun?.id && p.upos === "PRON"
);

const gates = [
  PRODUCT_READING_POLICY.readingEligibility,
  PRODUCT_READING_POLICY.preDrawReadingEligibility,
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
  PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
];

function slot(upos: Upos, id: string): StructuralLexicalSlot {
  return { kind: "lexical-slot", id, constituentKey: id, occurrenceIndex: 0,
    allowedUpos: [upos], requiredFunctions: [], requiredValencyFrames: [], requiredFeatures: {} };
}
const constituent = (upos: Upos, key: string) => ({
  category: "Lexeme" as const, key, minimum: 1, maximum: 1, recursive: false,
  allowedUpos: [upos], requiredFunctions: [], requiredValencyFrames: [], requiredFeatures: {},
});

function licensed(
  frontier: readonly RuntimeSyntaxProfile[], matchingSlot: StructuralLexicalSlot,
  previous: CatalogEntry | null
) {
  return frontier.filter(profile => {
    const entry = entryById.get(profile.entryId);
    if (!entry) throw new Error("missing source catalog entry " + profile.entryId);
    return gates.every(g => g(entry, profile, matchingSlot, previous));
  });
}
function pilotEligible(
  entry: CatalogEntry, profile: RuntimeSyntaxProfile, s: StructuralLexicalSlot,
  previous: CatalogEntry | null, forbidden: string, upos: Upos
) {
  return PRODUCT_READING_POLICY.readingEligibility(entry, profile, s, previous)
    && !(profile.upos === upos && entry.id === forbidden);
}

describe("PR #464 five exact role restorations: actual catalog and forced lexical reachability", () => {
  for (const item of cases) {
    it(item.text + "/" + item.upos + ": rejects only reviewed mismatch, rescues one legal profile, and composes it", () => {
      expect(pronoun).toBeDefined();
      expect(pronounProfile).toBeDefined();
      const targetProfiles = SYNTAX_PROFILES.filter(p =>
        p.upos === item.upos && (p.entryId === item.rejected || p.entryId === item.allowed));
      expect(targetProfiles).toHaveLength(2);
      const s = slot(item.upos, "target");
      const before = licensed(targetProfiles, s, null);
      expect(new Set(before.map(p=>p.entryId))).toEqual(new Set([item.rejected, item.allowed]));
      expect(excludeUnresolvedReadingGroups(before, entryById)).toEqual([]);

      const after = before.filter(profile => profile.entryId !== item.rejected);
      expect(after.map(p => p.entryId)).toEqual([item.allowed]);
      expect(excludeUnresolvedReadingGroups(after, entryById).map(p=>p.entryId)).toEqual([item.allowed]);

      const eligibleEntries = [entryById.get(item.rejected)!, entryById.get(item.allowed)!, pronoun!];
      const profiles = [...targetProfiles, pronounProfile!];
      const rules: readonly ProductionRule[] = [{
        id: "sentence.test-exact-role-"+item.text+"-"+item.upos, grammarVersion: FORMAL_GRAMMAR_VERSION,
        output: "Sentence", constituents: [constituent(item.upos, "target"), constituent("PRON", "anchor")],
        surfaceOrders: [{ id:"canonical",constituentKeys:["target","anchor"] }], constraints: [],
        positiveFixtureIds: ["positive"], negativeFixtureIds: ["negative"],
      }];
      const common = {
        eligibleEntries, profiles, rules, samplingMode: "raw" as const,
        lexicalSampling: "written-form" as const, maximumCandidates: 1, maximumAttempts: 10,
        random: { next: () => 0 }, entryWeight: (_: CatalogEntry) => 1,
        ...PRODUCT_READING_POLICY,
      };
      const baseline = composeFormalSyntaxUtterances(common);
      expect(baseline.candidates).toEqual([]);
      expect(baseline.fallbackReasons).toContain("formal-syntax-unresolved-reading-frontier");

      const restored = composeFormalSyntaxUtterances({
        ...common, readingEligibility: (e, p, currentSlot, prev) =>
          pilotEligible(e, p, currentSlot, prev, item.rejected, item.upos),
      });
      expect(restored.candidates).toHaveLength(1);
      expect(restored.candidates[0]!.entries.map(e => e.id)).toContain(item.allowed);
      expect(restored.candidates[0]!.entries.map(e => e.id)).not.toContain(item.rejected);
      expect(restored.candidates[0]!.entries.map(e => e.id)).toContain(pronoun!.id);

      // Cross-role noninterference: every other UPOS of the same written form
      // must produce identical legal frontiers with and without the pilot.
      for (const otherUpos of [...new Set(SYNTAX_PROFILES.filter(p =>
        p.entryId === item.rejected || p.entryId === item.allowed
      ).map(p=>p.upos))].filter(u=>u !== item.upos)) {
        const other = SYNTAX_PROFILES.filter(p=>p.upos === otherUpos
          && (p.entryId === item.rejected || p.entryId === item.allowed));
        const os = slot(otherUpos, "other");
        const original = licensed(other, os, null);
        const preview = original.filter(p=>!(!pilotEligible(
          entryById.get(p.entryId)!,p,os,null,item.rejected,item.upos
        )));
        expect(preview.map(p=>p.id)).toEqual(original.map(p=>p.id));
      }
    }, 60_000);
  }
});
