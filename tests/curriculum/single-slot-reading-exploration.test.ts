import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { selectFormalSyntaxUtterance } from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { trySingleSlotSourceReadingReplacement } from "../../src/curriculum/single-slot-reading-exploration.js";
import type { FormalSyntaxRealizationTrace } from "../../src/curriculum/formal-syntax-utterance.js";
import { createProductEnvironment, createFreshProgressForEnvironment } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";

describe("single-slot research transformation preserves original product structure", () => {
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
