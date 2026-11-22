import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { selectFormalSyntaxUtterance } from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { trySingleSlotSourceReadingReplacement, hasSameSyntacticRoleSignature } from "../../src/curriculum/single-slot-reading-exploration.js";
import type { FormalSyntaxRealizationTrace } from "../../src/curriculum/formal-syntax-utterance.js";
import { createProductEnvironment, createFreshProgressForEnvironment } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";

describe("single-slot research transformation preserves original product structure", () => {
  it("never treats broad slot compatibility as proof of identical syntactic roles", () => {
    const original = SYNTAX_PROFILES.find(p =>
      p.upos === "VERB" && p.functions.includes("predicate"));
    expect(original).toBeDefined();
    const same = { ...original!, functions:[...original!.functions].reverse(),
      valencyFrames:[...original!.valencyFrames].reverse() };
    expect(hasSameSyntacticRoleSignature(original!,same)).toBe(true);
    expect(hasSameSyntacticRoleSignature(original!,{...original!,upos:"NOUN"})).toBe(false);
    expect(hasSameSyntacticRoleSignature(original!,{...original!,
      functions:[...original!.functions,"new-function-only-in-other-entry"] as typeof original.functions,
    })).toBe(false);
    const differentFrame = original!.valencyFrames.includes("transitive")
      ? "intransitive" : "transitive";
    expect(hasSameSyntacticRoleSignature(original!,{...original!,
      valencyFrames:[...original!.valencyFrames,differentFrame],
    })).toBe(false);
    expect(hasSameSyntacticRoleSignature(original!,{...original!,
      occurrenceCapabilities:["voice-cau-ccomp-same-occurrence"],
    })).toBe(original!.occurrenceCapabilities?.length===1 &&
      original!.occurrenceCapabilities[0]==="voice-cau-ccomp-same-occurrence");
  });

  it("captures the chosen legal grammar exactly and leaves all non-target cases unchanged", () => {
    const env = createProductEnvironment({
      practice: PRACTICE_CATALOG,
      syntaxProfiles: SYNTAX_PROFILES,
    });
    const progress = createFreshProgressForEnvironment(
      env, "trace-smoke-test", "guided", "zhuyin-standard",
    );
    const seed = progress.seed + ":practice:" + progress.practiceRoundsCompleted;
    const traces = new Map<string, FormalSyntaxRealizationTrace>();
    const args = {
      entries: env.catalogs.practice,
      bindingEvidence: Object.values(progress.measurements.semantic.bindings),
      mode: progress.mode, layoutId: progress.layoutId,
      history: {
        recentEntryIds: progress.selection.recentEntryIds,
        recentUtteranceIds: progress.selection.recentUtteranceIds,
        recentWrittenForms: progress.selection.recentWrittenForms,
        recentConstructionIds: progress.selection.recentConstructionIds,
      },
      policy: env.utterancePolicy,
      profiles: env.catalogs.syntaxProfiles,
      ...PRODUCT_READING_POLICY,
      preparedFormalSyntaxLexicon: env.preparedPracticeLexicon,
      preparedFrequencyFirstEntries: env.preparedPracticeEntries,
      preparedFormalSyntaxExecution: env.preparedPracticeFormalSyntaxExecution,
    } as const;
    const baseline = selectFormalSyntaxUtterance({
      ...args, random: createSeededRandom(seed),
    }).utterance;
    const inspected = selectFormalSyntaxUtterance({
      ...args, random: createSeededRandom(seed),
      researchRealizationTrace: trace => traces.set(trace.realizationId, trace),
    }).utterance;
    expect(inspected).toEqual(baseline);
    const trace = traces.get(inspected.id);
    expect(trace).toBeDefined();
    expect(trace!.shape.id).toBe(inspected.syntaxDerivationId);
    const before = JSON.stringify(inspected);
    const unchanged = trySingleSlotSourceReadingReplacement({
      baseline: inspected, trace:trace!,
      index: env.preparedPracticeLexicon.index,
      candidateRoleReadingIds:new Map(),
      random:createSeededRandom("reading-extension-independent"),
      weight:()=>1,
    });
    expect(unchanged).toBeNull();
    expect(JSON.stringify(inspected)).toBe(before);
    expect(() => trySingleSlotSourceReadingReplacement({
      baseline: inspected,
      trace:{...trace!,realizationId:"mismatched-candidate"},
      index:env.preparedPracticeLexicon.index,
      candidateRoleReadingIds:new Map(),
      random:createSeededRandom("any"),
      weight:()=>1,
    })).toThrow("different finished sentence");
  });
});
