import { describe, expect, it } from "vitest";
import { selectLexicalProfile } from "../../src/curriculum/lexical-selection.js";
import { constructionIdentity } from "../../src/curriculum/selection-scoring.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY as policy,
  createFrequencyFirstSelectionState,
  selectFormalSyntaxUtterance,
  updateFrequencyFirstSelectionState,
} from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { excludeUnresolvedReadingGroups } from "../../src/readings/reading-frontier.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { PRACTICE, SYNTAX_PROFILES } from "../product/fixtures.js";

const first = { ...PRACTICE[0]!, id: "a", prompt: { text: "甲", locale: "zh-TW" as const } };
const second = { ...PRACTICE[1]!, id: "b", prompt: { text: "乙", locale: "zh-TW" as const } };
const alternate = { ...first, id: "a2" };
function profile(entry: CatalogEntry): RuntimeSyntaxProfile {
  return { ...SYNTAX_PROFILES.find(p => p.upos === "NOUN")!, id: `profile:${entry.id}`, entryId: entry.id };
}

function textCounts(entries: readonly CatalogEntry[], cache = false): Record<string, number> {
  const frontier = entries.map(profile);
  const entriesById = new Map(entries.map(entry => [entry.id, entry]));
  const counts: Record<string, number> = {};
  for (let index = 0; index < 1000; index += 1) {
    const selected = selectLexicalProfile({
      frontier, entriesById, weight: () => 1, sampling: "written-form",
      usedEntryIds: new Set(), reusableEntryId: undefined,
      random: { next: () => (index + 0.5) / 1000 },
      ...(cache ? { staticWeightKey: entriesById } : {}),
    })!;
    const text = entriesById.get(selected.entryId)!.prompt.text;
    counts[text] = (counts[text] ?? 0) + 1;
  }
  return counts;
}

const slot = {
  category: "Lexeme" as const, minimum: 1, maximum: 1, recursive: false,
  allowedUpos: ["NOUN" as const], requiredFunctions: [], requiredValencyFrames: [], requiredFeatures: {},
};
const rules: readonly ProductionRule[] = [{
  id: "sentence.quality", grammarVersion: FORMAL_GRAMMAR_VERSION, output: "Sentence",
  constituents: [{ ...slot, key: "first" }, { ...slot, key: "second" }],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["first", "second"] }],
  constraints: [], positiveFixtureIds: ["positive"], negativeFixtureIds: ["negative"],
}];

function select(options: {
  readonly history?: ReturnType<typeof createFrequencyFirstSelectionState>;
  readonly entries?: readonly CatalogEntry[];
  readonly bindingEvidence?: Parameters<typeof selectFormalSyntaxUtterance>[0]["bindingEvidence"];
  readonly maximumCandidateDraws?: number;
  readonly readingGate?: Parameters<typeof selectFormalSyntaxUtterance>[0]["finalCandidateReadingEligibility"];
  readonly frontierFilter?: Parameters<typeof selectFormalSyntaxUtterance>[0]["readingFrontierFilter"];
  readonly random?: Parameters<typeof selectFormalSyntaxUtterance>[0]["random"];
} = {}) {
  const entries = options.entries ?? [first, second];
  return selectFormalSyntaxUtterance({
    entries, profiles: entries.map(profile), bindingEvidence: options.bindingEvidence ?? [],
    mode: "guided", layoutId: "standard",
    history: options.history ?? createFrequencyFirstSelectionState(policy),
    policy: { ...policy, maximumCandidateDraws: options.maximumCandidateDraws ?? 4 },
    random: options.random ?? createSeededRandom("quality"),
    formalSyntaxComposition: { rules, samplingMode: "raw" },
    ...(options.readingGate === undefined ? {} : { finalCandidateReadingEligibility: options.readingGate }),
    ...(options.frontierFilter === undefined ? {} : { readingFrontierFilter: options.frontierFilter }),
  });
}

describe("hierarchical product selection quality", () => {
  it("carries reading abstention through the product selection boundary", () => {
    const third = { ...second, id: "c", prompt: { ...second.prompt, text: "丙" } };
    const result = select({ entries: [first, alternate, second, third],
      frontierFilter: excludeUnresolvedReadingGroups, random: { next: () => 0 } });
    expect(result.utterance.entries.map(entry => entry.id).sort()).toEqual([second.id, third.id].sort());
  });

  it("distinguishes clause constructions inside statements while sharing A-not-A variant identity", () => {
    const candidate = select().utterance;
    const identity = (root: string, clauses: readonly string[] = []) => constructionIdentity({
      ...candidate, syntaxRootRuleId: root, syntaxProductionRuleIds: [root, ...clauses],
    });
    expect(identity("sentence.declarative", ["clause.transitive"]))
      .not.toBe(identity("sentence.declarative", ["clause.ba"]));
    expect(identity("sentence.a-not-a-question")).toBe(identity("sentence.a-not-a-transitive-question"));
  });
  it("conserves written-form mass when another reading is admitted, including cached draws", () => {
    expect(textCounts([first, second])).toEqual({ 甲: 500, 乙: 500 });
    expect(textCounts([first, alternate, second])).toEqual(textCounts([first, second]));
    expect(textCounts([first, alternate, second], true)).toEqual(textCounts([first, second]));
  });

  it("composes text and reading adaptation into one normalized joint slot mass", () => {
    const entries = [first, alternate, second];
    const counts: Record<string, number> = {};
    const frontier = entries.map(profile);
    const entriesById = new Map(entries.map(entry => [entry.id, entry]));
    for (let index = 0; index < 8900; index += 1) {
      const selected = selectLexicalProfile({ frontier, entriesById,
        weight: entry => entry.id === alternate.id ? 1.45 : 1,
        sampling: "written-form", usedEntryIds: new Set(), reusableEntryId: undefined,
        random: { next: () => (index + 0.5) / 8900 },
      })!;
      counts[selected.entryId] = (counts[selected.entryId] ?? 0) + 1;
    }
    expect(counts).toEqual({ a: 2000, a2: 2900, b: 4000 });
  });

  it("excludes another reading of an already used written form", () => {
    const entries = [first, alternate, second];
    const base = {
      frontier: entries.map(profile), entriesById: new Map(entries.map(e => [e.id, e])),
      weight: () => 1, usedEntryIds: new Set([first.id]),
      random: { next: () => 0 }, sampling: "written-form" as const,
    };
    expect(selectLexicalProfile({ ...base, reusableEntryId: undefined })!.entryId).toBe(second.id);
    expect(selectLexicalProfile({ ...base, reusableEntryId: first.id })!.entryId).toBe(first.id);
  });

  it("filters a forbidden reading before drawing, without donating its mass to another word", () => {
    const original = select();
    const guarded = select({ entries: [first, alternate, second], readingGate: entry => entry.id !== alternate.id });
    expect(guarded.utterance).toEqual(original.utterance);
    expect(guarded.score.entryIds).not.toContain(alternate.id);
  });

  it("keeps repetition history across rounds and treats alternate readings as the same visible text", () => {
    const initial = select();
    const history = updateFrequencyFirstSelectionState(createFrequencyFirstSelectionState(policy), initial, policy);
    const next = select({ history, entries: [alternate, second], maximumCandidateDraws: 1 });
    expect(next.score.recentUtteranceFactor).toBeLessThan(1);
    expect(next.score.recentConstructionFactor).toBeLessThan(1);
    expect(next.score.entries.every(score => score.recentEntryFactor < 1)).toBe(true);
    const updated = updateFrequencyFirstSelectionState(history, next, policy);
    expect(updated.recentEntryIds).toContain(first.id);
    expect(updated.recentEntryIds).toContain(alternate.id);
    expect(updated.recentWrittenForms).toHaveLength(2);
  });

  it("reports only local lexical weights and actual bounded acceptance, without a fictional sentence total", () => {
    const long = { ...first, syllables: Array.from({ length: 16 }, () => first.syllables[0]!) };
    const result = select({ entries: [long, second] });
    expect(result.score.syllables).toBe(18);
    expect(result.score.burdenFactor).toBeLessThan(1);
    expect(result.score.acceptanceProbability).toBe(result.score.burdenFactor);
    expect("totalWeight" in result.score).toBe(false);
    expect(result.generationAttempts).toBeLessThanOrEqual(policy.maximumCandidateDraws);
    expect(result.score.entries.every(entry => entry.totalWeight > 0)).toBe(true);
  });

  it("terminates with explicit legal best effort when every candidate is rejected", () => {
    const random = { next: () => 0.99999 };
    const initial = select({ random });
    const history = updateFrequencyFirstSelectionState(createFrequencyFirstSelectionState(policy), initial, policy);
    const result = select({ history, random });
    expect(result.acceptance).toBe("bounded-best-effort");
    expect(result.generationAttempts).toBe(policy.maximumCandidateDraws);
    expect(result.grammarFallbackReasons).toContain("candidate-acceptance-budget-exhausted");
    expect(result.utterance.entries).toHaveLength(2);
  });

  it("uses recent correctness instead of a lifetime error rate and ignores one unusually fast sample", () => {
    const scope = { mode: "guided" as const, layoutId: "standard", tokenId: "zhuyin:ㄇ" };
    const evidence = {
      scope, attempts: 10000, errors: 9000, timingSamples: 100,
      currentTimeToTypeMs: 200, bestTimeToTypeMs: 1,
      selectionEvidence: { correctness: Array<boolean>(32).fill(true), timingMs: [1, ...Array<number>(23).fill(200)] },
    };
    const healthy = select({ bindingEvidence: [evidence] });
    const trace = healthy.score.entries[0]!.expectedTokenTrace.find(trace => trace.tokenId === scope.tokenId)!;
    expect(trace.errorRate).toBe(0);
    expect(trace.timingRatio).toBe(1);
    const struggling = select({ bindingEvidence: [{ ...evidence,
      selectionEvidence: { ...evidence.selectionEvidence, correctness: Array<boolean>(32).fill(false) },
    }] });
    const weak = struggling.score.entries[0]!.expectedTokenTrace.find(trace => trace.tokenId === scope.tokenId)!;
    expect(weak.boost).toBe(policy.maximumExpectedTokenBoost);
    expect(healthy.score.entries[0]!.expectedTokenTrace.some(trace => trace.coverageContribution > 0)).toBe(true);
  });

  it("starts a fresh adaptation window for old aggregates without discarding diagnostic history", () => {
    const result = select({ bindingEvidence: [{
      scope: { mode: "guided", layoutId: "standard", tokenId: "zhuyin:ㄇ" },
      attempts: 100, errors: 100, timingSamples: 100, currentTimeToTypeMs: 900, bestTimeToTypeMs: 1,
    }] });
    const trace = result.score.entries[0]!.expectedTokenTrace.find(trace => trace.tokenId === "zhuyin:ㄇ")!;
    expect(trace.attempts).toBe(100);
    expect(trace.errorRate).toBeNull();
    expect(trace.timingRatio).toBeNull();
  });
});
