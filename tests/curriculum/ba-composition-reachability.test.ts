import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import type { RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../../src/syntax/realize.js";
import { BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";

class SeededRandom implements RandomSource {
  private state = 0x4ba2026;

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

function canonicalBaPredicateSlot() {
  const keep = new Set([
    "clause.ba",
    "argument.subject.noun",
    "argument.disposal-patient.noun",
    "predicate.verb.lexical",
    "phrase.noun.bare",
    "phrase.nominal-head.noun",
  ]);
  const shapes = [...enumerateStructuralDerivations({
    rootCategory: "Clause",
    rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
  })];
  expect(shapes).toHaveLength(1);
  const slot = shapes[0]!.lexicalSlots.find((candidate) =>
    candidate.allowedUpos.length === 1
      && candidate.allowedUpos[0] === "VERB"
      && candidate.requiredOccurrenceCapabilities?.includes(
        BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
      )
  );
  expect(slot).toBeDefined();
  return slot!;
}

describe("packaged BA composition reachability", () => {
  it("retains a non-empty identity-safe lexical predicate frontier", () => {
    const packagedBaProfiles = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );
    expect(packagedBaProfiles).toHaveLength(139);

    const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
    const reachable = compatibleProfilesForSlot(canonicalBaPredicateSlot(), index);
    console.log(`BA_COMPOSITION_REACHABLE_PREDICATES=${reachable.length}`);

    expect(reachable.length).toBeGreaterThan(0);
    expect(reachable.every((profile) =>
      profile.upos === "VERB"
      && (profile.occurrenceCapabilities?.includes(
        BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false)
    )).toBe(true);
  });

  it("realizes a targeted BA sentence from the packaged catalog and profiles", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: new SeededRandom(),
      maximumCandidates: 1,
      maximumAttempts: 256,
      rules: FORMAL_SYNTAX_RULES,
      samplingMode: "raw",
      structuralTarget: {
        rootProductionRuleId: "sentence.declarative",
        nestedProductionTargets: [{
          parentRuleId: "sentence.declarative",
          constituentKey: "clause",
          childRuleId: "clause.ba",
        }],
      },
    });

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0]!;
    expect(candidate.syntaxRootRuleId).toBe("sentence.declarative");
    expect(candidate.entries.some((entry) => entry.prompt.text === "把" || entry.prompt.text === "將"))
      .toBe(true);

    const profilesById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
    const selectedProfiles = candidate.syntaxProfileIds
      .map((profileId) => profilesById.get(profileId))
      .filter((profile) => profile !== undefined);
    expect(selectedProfiles.some((profile) =>
      profile.upos === "VERB"
      && (profile.occurrenceCapabilities?.includes(
        BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false)
    )).toBe(true);
  });
});
