import {
  UD_GSD_FILENAMES,
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
} from "./ud-occurrence-source.js";

export const CAUSATIVE_REVIEWED_FEATURE = "Voice=Cau" as const;
export const CAUSATIVE_OCCURRENCE_CAPABILITY = "voice-cau-ccomp-same-occurrence" as const;
export const CAUSATIVE_OCCURRENCE_EVIDENCE_CONTRACT = "same-token-voice-cau-direct-ccomp-v1" as const;

export {
  UD_GSD_FILENAMES,
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  lexemeUposKey,
};

export interface CausativeOccurrenceEvidence {
  readonly voiceCauTokenCount: number;
  readonly voiceCauCounts: ReadonlyMap<string, number>;
  readonly sameTokenCcompTokenCount: number;
  readonly sameTokenCcompCounts: ReadonlyMap<string, number>;
  readonly sameTokenCcompOwnSubjectTokenCount: number;
  readonly sameTokenCcompOwnSubjectCounts: ReadonlyMap<string, number>;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function parseCausativeOccurrenceEvidence(source: string): CausativeOccurrenceEvidence {
  const voiceCauCounts = new Map<string, number>();
  const sameTokenCcompCounts = new Map<string, number>();
  const sameTokenCcompOwnSubjectCounts = new Map<string, number>();
  let voiceCauTokenCount = 0;
  let sameTokenCcompTokenCount = 0;
  let sameTokenCcompOwnSubjectTokenCount = 0;

  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    for (const token of tokens) {
      if (!token.feats.split("|").includes(CAUSATIVE_REVIEWED_FEATURE)) continue;
      voiceCauTokenCount += 1;
      const key = lexemeUposKey(token.form, token.upos);
      increment(voiceCauCounts, key);

      const ccompChildren = (childrenByHead.get(token.id) ?? [])
        .filter((child) => child.relation === "ccomp");
      if (ccompChildren.length === 0) continue;
      sameTokenCcompTokenCount += 1;
      increment(sameTokenCcompCounts, key);

      const hasEmbeddedSubject = ccompChildren.some((child) =>
        (childrenByHead.get(child.id) ?? []).some((candidate) =>
          candidate.relation === "nsubj" || candidate.relation.startsWith("nsubj:"),
        ),
      );
      if (!hasEmbeddedSubject) continue;
      sameTokenCcompOwnSubjectTokenCount += 1;
      increment(sameTokenCcompOwnSubjectCounts, key);
    }
  }

  return {
    voiceCauTokenCount,
    voiceCauCounts,
    sameTokenCcompTokenCount,
    sameTokenCcompCounts,
    sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectCounts,
  };
}

function mergeCounts(target: Map<string, number>, source: ReadonlyMap<string, number>): void {
  for (const [key, count] of source) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

export function mergeCausativeOccurrenceEvidence(
  observations: readonly CausativeOccurrenceEvidence[],
): CausativeOccurrenceEvidence {
  const voiceCauCounts = new Map<string, number>();
  const sameTokenCcompCounts = new Map<string, number>();
  const sameTokenCcompOwnSubjectCounts = new Map<string, number>();
  let voiceCauTokenCount = 0;
  let sameTokenCcompTokenCount = 0;
  let sameTokenCcompOwnSubjectTokenCount = 0;

  for (const observation of observations) {
    voiceCauTokenCount += observation.voiceCauTokenCount;
    sameTokenCcompTokenCount += observation.sameTokenCcompTokenCount;
    sameTokenCcompOwnSubjectTokenCount += observation.sameTokenCcompOwnSubjectTokenCount;
    mergeCounts(voiceCauCounts, observation.voiceCauCounts);
    mergeCounts(sameTokenCcompCounts, observation.sameTokenCcompCounts);
    mergeCounts(sameTokenCcompOwnSubjectCounts, observation.sameTokenCcompOwnSubjectCounts);
  }

  return {
    voiceCauTokenCount,
    voiceCauCounts,
    sameTokenCcompTokenCount,
    sameTokenCcompCounts,
    sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectCounts,
  };
}

export async function loadPinnedCausativeOccurrenceEvidence(): Promise<CausativeOccurrenceEvidence> {
  const observations = (await loadPinnedUdGsdOccurrenceSources())
    .map(parseCausativeOccurrenceEvidence);
  return mergeCausativeOccurrenceEvidence(observations);
}
