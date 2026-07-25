import type { CatalogEntry } from "../../src/core/model.js";
import type { BindingAggregate } from "../../src/measurement/types.js";
import {
  createEmptyCurriculumProfile,
  profileFromAggregates,
} from "../../src/curriculum/simulator.js";
import { createCatalogSupportIndex } from "../../src/curriculum/support.js";
import type { CurriculumProfile } from "../../src/curriculum/types.js";

function entry(
  id: string,
  selectionWeight: number,
  syllables: readonly (readonly string[])[],
): CatalogEntry {
  return {
    id,
    prompt: { text: id, locale: "zh-TW" },
    syllables: syllables.map((tokens) => ({ tokens })),
    commonnessBase: {
      modelVersion: "commonness-v1",
      sourceId: "test",
      sourceVersion: "test-v1",
      sourceRowId: id,
      spokenPerMillion: null,
      writtenPerMillion: null,
      spokenStrength: null,
      writtenStrength: null,
      score: selectionWeight,
      selectionWeight,
      confidence: "reviewed",
      reasons: [],
    },
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

export const catalog = [
  entry("e1", 0.9, [["token:X", "token:B", "tone:1"], ["token:A", "tone:2"]]),
  entry("e2", 0.9, [["token:Y", "token:B", "tone:2"], ["token:A", "tone:3"]]),
  entry("e3", 0.5, [["token:Z", "token:B", "tone:3"], ["token:A", "tone:4"]]),
  entry("e4", 0.9, [["token:X", "token:D", "tone:1"], ["token:A", "tone:5"]]),
  entry("e5", 0.1, [["token:Z", "tone:4"], ["token:C", "tone:1"]]),
  entry("e6", 0.5, [["token:Y", "token:D", "tone:5"], ["token:A", "tone:2"]]),
  entry("e7", 0.9, [["token:X", "token:B", "tone:5"], ["token:A", "tone:3"]]),
  entry("e8", 0.5, [["token:Z", "token:D", "tone:2"], ["token:A", "tone:4"]]),
] as const;

export const support = createCatalogSupportIndex(catalog);

export function aggregate(
  profile: CurriculumProfile,
  tokenId: string,
  timingMs: number | null,
  errorRate: number,
  attempts = 12,
): BindingAggregate {
  const record = profile.bindings[tokenId];
  if (record === undefined) throw new Error(`unknown test token ${tokenId}`);
  const timed = timingMs !== null;
  return {
    scope: record.scope,
    attempts,
    errors: Math.round(attempts * errorRate),
    timingSamples: timed ? attempts : 0,
    currentTimeToTypeMs: timingMs,
    bestTimeToTypeMs: timingMs === null ? null : timingMs * 0.8,
    timingExclusions: {
      syllableStart: timed ? 0 : attempts,
      incorrect: 0,
      recovery: 0,
      interactionNoise: 0,
    },
  };
}

export function eligibleProfile(
  overrides: Readonly<Record<string, { timingMs: number | null; errorRate: number }>> = {},
): CurriculumProfile {
  const empty = createEmptyCurriculumProfile(
    support,
    "guided",
    "zhuyin-standard",
  );
  const aggregates = Object.keys(support.byToken).map((tokenId) => {
    const motorSupported = support.byToken[tokenId]!.motorEntryCount >= 3;
    const value = overrides[tokenId]
      ?? { timingMs: motorSupported ? 180 : null, errorRate: 0.02 };
    return aggregate(empty, tokenId, value.timingMs, value.errorRate);
  });
  return profileFromAggregates(
    support,
    "guided",
    "zhuyin-standard",
    aggregates,
  );
}
