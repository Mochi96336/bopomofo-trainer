import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
} from "./ud-occurrence-source.js";

export const BA_MARKERS = ["把", "將"] as const;
export const BA_OCCURRENCE_EVIDENCE_CONTRACT = "same-predicate-obl-patient-case-ba-v1" as const;

export interface BaOccurrenceEvidence {
  /** Predicate tokens with a direct exact `obl:patient` child. */
  readonly oblPatientPredicateTokenCount: number;
  readonly oblPatientPredicateCounts: ReadonlyMap<string, number>;
  /**
   * Predicate tokens whose direct `obl:patient` child itself owns a `case`
   * ADP whose surface form is reviewed as a BA marker (`把` or `將`).
   */
  readonly baMarkedPatientPredicateTokenCount: number;
  readonly baMarkedPatientPredicateCounts: ReadonlyMap<string, number>;
  readonly markerCounts: ReadonlyMap<string, number>;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function parseBaOccurrenceEvidence(source: string): BaOccurrenceEvidence {
  const oblPatientPredicateCounts = new Map<string, number>();
  const baMarkedPatientPredicateCounts = new Map<string, number>();
  const markerCounts = new Map<string, number>();
  let oblPatientPredicateTokenCount = 0;
  let baMarkedPatientPredicateTokenCount = 0;

  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    for (const predicate of tokens) {
      const patients = (childrenByHead.get(predicate.id) ?? [])
        .filter((child) => child.relation === "obl:patient");
      if (patients.length === 0) continue;

      const key = lexemeUposKey(predicate.form, predicate.upos);
      oblPatientPredicateTokenCount += 1;
      increment(oblPatientPredicateCounts, key);

      const markers = patients.flatMap((patient) =>
        (childrenByHead.get(patient.id) ?? []).filter((candidate) =>
          candidate.relation === "case"
          && candidate.upos === "ADP"
          && BA_MARKERS.includes(candidate.form as (typeof BA_MARKERS)[number]),
        ),
      );
      if (markers.length === 0) continue;

      baMarkedPatientPredicateTokenCount += 1;
      increment(baMarkedPatientPredicateCounts, key);
      for (const marker of markers) increment(markerCounts, marker.form);
    }
  }

  return {
    oblPatientPredicateTokenCount,
    oblPatientPredicateCounts,
    baMarkedPatientPredicateTokenCount,
    baMarkedPatientPredicateCounts,
    markerCounts,
  };
}

function mergeCounts(target: Map<string, number>, source: ReadonlyMap<string, number>): void {
  for (const [key, count] of source) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

export function mergeBaOccurrenceEvidence(
  observations: readonly BaOccurrenceEvidence[],
): BaOccurrenceEvidence {
  const oblPatientPredicateCounts = new Map<string, number>();
  const baMarkedPatientPredicateCounts = new Map<string, number>();
  const markerCounts = new Map<string, number>();
  let oblPatientPredicateTokenCount = 0;
  let baMarkedPatientPredicateTokenCount = 0;

  for (const observation of observations) {
    oblPatientPredicateTokenCount += observation.oblPatientPredicateTokenCount;
    baMarkedPatientPredicateTokenCount += observation.baMarkedPatientPredicateTokenCount;
    mergeCounts(oblPatientPredicateCounts, observation.oblPatientPredicateCounts);
    mergeCounts(baMarkedPatientPredicateCounts, observation.baMarkedPatientPredicateCounts);
    mergeCounts(markerCounts, observation.markerCounts);
  }

  return {
    oblPatientPredicateTokenCount,
    oblPatientPredicateCounts,
    baMarkedPatientPredicateTokenCount,
    baMarkedPatientPredicateCounts,
    markerCounts,
  };
}

export async function loadPinnedBaOccurrenceEvidence(): Promise<BaOccurrenceEvidence> {
  return mergeBaOccurrenceEvidence(
    (await loadPinnedUdGsdOccurrenceSources()).map(parseBaOccurrenceEvidence),
  );
}
