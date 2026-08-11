import { describe, expect, it } from "vitest";
import type { LexicalCompatibilityIndex } from "../../src/compatibility/lexical-pairs.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  structuralDependencyCompatibilityMultiplier,
} from "../../src/curriculum/formal-syntax-dependency-compatibility.js";

function entry(id: string, text: string): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    commonnessBase: {
      modelVersion: "commonness-v1",
      sourceId: "test",
      sourceVersion: "test-v1",
      sourceRowId: id,
      spokenPerMillion: null,
      writtenPerMillion: null,
      spokenStrength: null,
      writtenStrength: null,
      score: 1,
      selectionWeight: 1,
      confidence: "reviewed",
      reasons: [],
    },
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

const LET = entry("entry:let", "讓");
const HE = entry("entry:he", "他");
const WALK = entry("entry:walk", "走");
const INDEX: LexicalCompatibilityIndex = {
  surfaceScoreByPair: new Map(),
  dependencyScoreByPair: new Map([
    [JSON.stringify(["讓", "走", "ccomp"]), 0.5],
    [JSON.stringify(["走", "他", "nsubj"]), 0.25],
  ]),
};
const EDGES = [
  { headSlotId: "matrix", dependentSlotId: "embedded", relation: "ccomp" as const },
  { headSlotId: "embedded", dependentSlotId: "subject", relation: "nsubj" as const },
];

describe("formal syntax structural dependency compatibility", () => {
  it("boosts a current dependent from an already-selected structural head", () => {
    expect(structuralDependencyCompatibilityMultiplier(
      INDEX,
      WALK,
      {
        currentSlotId: "embedded",
        selectedEntriesBySlotId: new Map([["matrix", LET]]),
        edges: EDGES,
      },
      1,
    )).toBe(1.5);
  });

  it("multiplies independent positive edges available when the current head is selected", () => {
    expect(structuralDependencyCompatibilityMultiplier(
      INDEX,
      WALK,
      {
        currentSlotId: "embedded",
        selectedEntriesBySlotId: new Map([
          ["matrix", LET],
          ["subject", HE],
        ]),
        edges: EDGES,
      },
      1,
    )).toBe(1.875);
  });

  it("keeps missing dependency evidence neutral", () => {
    expect(structuralDependencyCompatibilityMultiplier(
      INDEX,
      LET,
      {
        currentSlotId: "matrix",
        selectedEntriesBySlotId: new Map([["embedded", HE]]),
        edges: EDGES,
      },
      4,
    )).toBe(1);
    expect(structuralDependencyCompatibilityMultiplier(
      undefined,
      WALK,
      {
        currentSlotId: "embedded",
        selectedEntriesBySlotId: new Map([["matrix", LET]]),
        edges: EDGES,
      },
      4,
    )).toBe(1);
  });
});
