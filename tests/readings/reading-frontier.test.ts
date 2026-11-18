import { describe, expect, it, vi } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { excludeUnresolvedReadingGroups } from "../../src/readings/reading-frontier.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import { PRACTICE, SYNTAX_PROFILES } from "../product/fixtures.js";

const entry = (text: string, reading: string): CatalogEntry => ({
  ...PRACTICE[0]!, id: catalogEntryId(text, reading), prompt: { text, locale: "zh-TW" },
});
const a = entry("甲", "ㄐㄧㄚ3"), alternate = entry("甲", "ㄐㄧㄚ4");
const b = entry("乙", "ㄧ3"), c = entry("丙", "ㄅㄧㄥ3");
function profile(e: CatalogEntry, upos: Upos = "NOUN"): RuntimeSyntaxProfile {
  return { ...SYNTAX_PROFILES[0]!, id: `profile:${e.id}:${upos}`, entryId: e.id, upos };
}
function filter(entries: readonly CatalogEntry[], profiles = entries.map(e => profile(e))) {
  return excludeUnresolvedReadingGroups(profiles, new Map(entries.map(e => [e.id, e])));
}
const constituent = { category: "Lexeme" as const, minimum: 1, maximum: 1, recursive: false,
  allowedUpos: ["NOUN" as const], requiredFunctions: [], requiredValencyFrames: [], requiredFeatures: {} };
const rules: readonly ProductionRule[] = [{
  id: "sentence.abstention", grammarVersion: FORMAL_GRAMMAR_VERSION, output: "Sentence",
  constituents: [{ ...constituent, key: "first" }, { ...constituent, key: "second" }],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["first", "second"] }], constraints: [],
  positiveFixtureIds: ["positive"], negativeFixtureIds: ["negative"],
}];

describe("unresolved sentence-reading abstention", () => {
  it("excludes every reading of an unresolved same-slot written-form/UPOS group", () => {
    expect(filter([a, alternate, b]).map(p => p.entryId)).toEqual([b.id]);
    expect(filter([a, b]).map(p => p.entryId)).toEqual([a.id, b.id]);
  });

  it("does not confuse multiple profiles or distinct lexical roles with competing readings", () => {
    const p = profile(a);
    expect(filter([a], [p, { ...p, id: "another-profile" }])).toHaveLength(2);
    expect(filter([a, alternate], [profile(a), profile(alternate, "VERB")])).toHaveLength(2);
  });

  it("retains only explicitly reviewed free alternants and abstains again if another reading appears", () => {
    for (const [text, readings, upos] of [
      ["哪", ["ㄋㄚ3", "ㄋㄟ3"], "PRON"],
      ["和", ["ㄏㄜ2", "ㄏㄢ4"], "CCONJ"],
    ] as const) {
      const entries = readings.map(reading => entry(text, reading));
      expect(filter(entries, entries.map(e => profile(e, upos)))).toHaveLength(2);
      const expanded = [...entries, entry(text, "ㄐㄧㄚ3")];
      expect(filter(expanded, expanded.map(e => profile(e, upos)))).toEqual([]);
    }
  });

  it("abstains before any learner weight can choose or suppress an ambiguous reading", () => {
    const entries = [a, alternate, b, c];
    const weight = vi.fn((e: CatalogEntry) => e.id === alternate.id ? 0 : e.id === a.id ? 1000 : 1);
    const result = composeFormalSyntaxUtterances({ eligibleEntries: entries, profiles: entries.map(e => profile(e)),
      rules, samplingMode: "raw", lexicalSampling: "written-form", random: { next: () => 0 },
      maximumCandidates: 1, maximumAttempts: 1, entryWeight: weight,
      readingFrontierFilter: excludeUnresolvedReadingGroups,
    });
    expect(result.candidates[0]!.entries.map(e => e.id).sort()).toEqual([b.id, c.id].sort());
    expect(weight.mock.calls.every(([e]) => e.id !== a.id && e.id !== alternate.id)).toBe(true);
  });

  it("allows a singleton established by an independent reading license before abstention", () => {
    const entries = [a, alternate, b];
    const result = composeFormalSyntaxUtterances({ eligibleEntries: entries, profiles: entries.map(e => profile(e)),
      rules, samplingMode: "raw", lexicalSampling: "written-form", random: { next: () => 0 },
      maximumCandidates: 1, maximumAttempts: 1, readingEligibility: e => e.id !== alternate.id,
      readingFrontierFilter: excludeUnresolvedReadingGroups,
    });
    expect(result.candidates[0]!.entries.map(e => e.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("checks the full frontier before a repeated identity binding narrows it", () => {
    const entries = [a, alternate, b];
    const boundRules = rules.map(rule => ({ ...rule, constituents: rule.constituents.map(item => ({
      ...item, entryBinding: "repeated",
    })) }));
    const result = composeFormalSyntaxUtterances({ eligibleEntries: entries, profiles: entries.map(e => profile(e)),
      rules: boundRules, samplingMode: "raw", lexicalSampling: "written-form", random: { next: () => 0 },
      maximumCandidates: 1, maximumAttempts: 1, entryWeight: e => e.id === a.id ? 1000 : 1,
      readingFrontierFilter: excludeUnresolvedReadingGroups,
    });
    expect(result.candidates[0]!.entries.map(e => e.id)).toEqual([b.id, b.id]);
    const blocked = composeFormalSyntaxUtterances({ eligibleEntries: [a, alternate],
      profiles: [profile(a), profile(alternate)], rules: boundRules, samplingMode: "raw",
      lexicalSampling: "written-form", random: { next: () => 0 }, maximumCandidates: 1, maximumAttempts: 1,
      readingFrontierFilter: excludeUnresolvedReadingGroups,
    });
    expect(blocked.candidates).toEqual([]);
    expect(blocked.fallbackReasons).toContain("formal-syntax-unresolved-reading-frontier");
  });

  it("rechecks set-level ambiguity when final lexical adjacency differs across a literal", () => {
    const literalRules: readonly ProductionRule[] = [{ ...rules[0]!, constituents: [
      { ...constituent, key: "first", allowedUpos: ["VERB"] },
      { ...constituent, key: "boundary", allowedUpos: ["PUNCT"], formalLiteral: "|" },
      { ...constituent, key: "second" },
    ], surfaceOrders: [{ id: "canonical", constituentKeys: ["first", "boundary", "second"] }] }];
    const entries = [a, alternate, c];
    const result = composeFormalSyntaxUtterances({ eligibleEntries: entries,
      profiles: [profile(a), profile(alternate), profile(c, "VERB")], rules: literalRules,
      samplingMode: "raw", lexicalSampling: "written-form", random: { next: () => 0 },
      maximumCandidates: 1, maximumAttempts: 1,
      readingEligibility: (e, _profile, _slot, previous) => e.id !== alternate.id || previous !== null,
      readingFrontierFilter: excludeUnresolvedReadingGroups,
    });
    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-reading-context-rejected");
  });
});
