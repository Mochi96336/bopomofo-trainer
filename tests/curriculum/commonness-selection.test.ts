import { describe, expect, it } from "vitest";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFrequencyFirstUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import type { GrammarAnnotation } from "../../src/grammar/types.js";
import type { MeasurementSummary } from "../../src/measurement/types.js";

const measurement: MeasurementSummary = {
  policyVersion: "fixture",
  traceCount: 0,
  bindingObservationCount: 0,
  confusionObservationCount: 0,
  transitionObservationCount: 0,
  bindings: {},
  confusions: {},
  transitions: {},
};
const random: RandomSource = { next: () => 0 };

function entry(
  id: string,
  selectionWeight?: number,
): CatalogEntry {
  const commonness = selectionWeight === undefined
    ? {}
    : {
      commonnessBase: {
        modelVersion: "commonness-v1",
        sourceId: "fixture",
        sourceVersion: "1",
        sourceRowId: id,
        spokenPerMillion: 1,
        writtenPerMillion: 1,
        spokenStrength: 1,
        writtenStrength: 1,
        score: selectionWeight,
        selectionWeight,
        confidence: "reviewed" as const,
        reasons: ["fixture"],
      },
    };
  return {
    id,
    prompt: { text: id, locale: "zh-TW" },
    syllables: [{ tokens: [id] }],
    ...commonness,
    tags: [],
    provenanceIds: [],
  };
}

function annotation(id: string): GrammarAnnotation {
  return {
    entryId: id,
    roles: ["formulaic"],
    predicateFrame: "none",
    standaloneKind: "utterance",
    provenanceIds: [],
  };
}

function select(entries: readonly CatalogEntry[]) {
  return selectFrequencyFirstUtterance({
    entries,
    annotations: Object.fromEntries(
      entries.map((item) => [item.id, annotation(item.id)]),
    ),
    measurement,
    mode: "guided",
    layoutId: "standard",
    history: {
      recentEntryIds: [],
      recentUtteranceIds: [],
      recentTemplateIds: [],
    },
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    random,
  });
}

describe("commonness-backed utterance selection", () => {
  // Reviewed evidence is the only source of a selection weight. An entry
  // without it weighs the same as the most common word rather than falling
  // back to a second notion of how common it is.
  it("uses reviewed commonness and weighs unmeasured entries evenly", () => {
    const result = select([
      entry("projected", 0.8),
      entry("unmeasured"),
    ]);
    const candidates = result.slotSelections[0]?.candidates ?? [];
    const projected = candidates.find((item) => item.entryId === "projected")!;
    const unmeasured = candidates.find((item) => item.entryId === "unmeasured")!;
    expect(projected.frequencyBase).toBe(0.8);
    expect(unmeasured.frequencyBase).toBe(1);
  });

  it("offers every entry as a candidate", () => {
    const result = select([
      entry("rare", 0.05),
      entry("common", 1),
    ]);
    expect(result.slotSelections[0]?.candidates.map((item) => item.entryId))
      .toEqual(["common", "rare"]);
  });
});
