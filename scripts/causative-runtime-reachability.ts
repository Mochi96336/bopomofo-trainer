import type { RuntimeSyntaxProfile, ValencyFrame } from "../src/syntax/types.js";

export const CAUSATIVE_EMBEDDING_SELECTORS = {
  finiteCcomp: "clausal-complement",
  subjectControlledXcomp: "subject-controlled-open-complement",
  objectControlledXcomp: "object-controlled-open-complement",
  untypedOpenXcomp: "open-clausal-complement",
} as const satisfies Readonly<Record<string, ValencyFrame>>;

export type CausativeEmbeddingSelector = keyof typeof CAUSATIVE_EMBEDDING_SELECTORS;

export interface CausativeEmbeddingSupportCount {
  readonly profileCount: number;
  readonly entryCount: number;
}

export interface CausativeRuntimeReachabilitySummary {
  readonly reviewedFeature: "Voice=Cau";
  readonly morphologyProfileCount: number;
  readonly morphologyEntryCount: number;
  readonly selectorSupport: Readonly<Record<CausativeEmbeddingSelector, CausativeEmbeddingSupportCount>>;
  readonly noReviewedEmbeddingProfileCount: number;
  readonly multiSelectorProfileCount: number;
}

function hasReviewedCausativeMorphology(profile: RuntimeSyntaxProfile): boolean {
  return profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] === 1;
}

function supportCount(
  profiles: readonly RuntimeSyntaxProfile[],
  frame: ValencyFrame,
): CausativeEmbeddingSupportCount {
  const matches = profiles.filter((profile) => profile.valencyFrames.includes(frame));
  return {
    profileCount: matches.length,
    entryCount: new Set(matches.map((profile) => profile.entryId)).size,
  };
}

/**
 * Measure the executable intersection between reviewed `Voice=Cau` predicate
 * marking and independently projected embedding capabilities. This function
 * does not reinterpret morphology as valency and does not promote generic
 * xcomp evidence into a typed controller relation.
 */
export function summarizeCausativeRuntimeReachability(
  profiles: readonly RuntimeSyntaxProfile[],
): CausativeRuntimeReachabilitySummary {
  const causativeProfiles = profiles.filter(hasReviewedCausativeMorphology);
  const selectorEntries = Object.entries(CAUSATIVE_EMBEDDING_SELECTORS) as readonly (
    readonly [CausativeEmbeddingSelector, ValencyFrame]
  )[];
  const selectorSupport = Object.fromEntries(selectorEntries.map(([selector, frame]) => [
    selector,
    supportCount(causativeProfiles, frame),
  ])) as Readonly<Record<CausativeEmbeddingSelector, CausativeEmbeddingSupportCount>>;

  let noReviewedEmbeddingProfileCount = 0;
  let multiSelectorProfileCount = 0;
  for (const profile of causativeProfiles) {
    const selectorMatches = selectorEntries.filter(([, frame]) => profile.valencyFrames.includes(frame)).length;
    if (selectorMatches === 0) noReviewedEmbeddingProfileCount += 1;
    if (selectorMatches > 1) multiSelectorProfileCount += 1;
  }

  return {
    reviewedFeature: "Voice=Cau",
    morphologyProfileCount: causativeProfiles.length,
    morphologyEntryCount: new Set(causativeProfiles.map((profile) => profile.entryId)).size,
    selectorSupport,
    noReviewedEmbeddingProfileCount,
    multiSelectorProfileCount,
  };
}
