import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const COMPARATIVE_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-bi-comparative-shape-inventory-v1" as const;

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function increment(target: Map<string, number>, key: string): void {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function sortedRecord(values: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(
    [...values].sort(([left], [right]) => left.localeCompare(right, "zh-Hant")),
  );
}

function hasSubject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const relation = relationBase(child.relation);
    return relation === "nsubj" || relation === "csubj";
  });
}

export interface ComparativeSourceEvidenceSummary {
  readonly contract: typeof COMPARATIVE_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly biTokenCount: number;
  readonly biUposRelationCounts: Readonly<Record<string, number>>;
  readonly exactCaseAdpTokenCount: number;
  readonly standardHeadUposCounts: Readonly<Record<string, number>>;
  readonly standardRelationCounts: Readonly<Record<string, number>>;
  readonly nominalStandardTokenCount: number;
  readonly governingPredicateTokenCount: number;
  readonly governingPredicateUposCounts: Readonly<Record<string, number>>;
  readonly governingPredicateRelationCounts: Readonly<Record<string, number>>;
  readonly comparativePredicateCounts: ReadonlyMap<string, number>;
  readonly adjectivalPredicateTokenCount: number;
  readonly verbalPredicateTokenCount: number;
  readonly markerBeforeStandardTokenCount: number;
  readonly standardBeforePredicateTokenCount: number;
  readonly predicateWithSubjectTokenCount: number;
  readonly predicateWithoutSubjectTokenCount: number;
  readonly predicateRootTokenCount: number;
  readonly predicateNonRootTokenCount: number;
}

export function summarizeComparativeSourceEvidence(
  sources: readonly string[],
): ComparativeSourceEvidenceSummary {
  const biUposRelationCounts = new Map<string, number>();
  const standardHeadUposCounts = new Map<string, number>();
  const standardRelationCounts = new Map<string, number>();
  const governingPredicateUposCounts = new Map<string, number>();
  const governingPredicateRelationCounts = new Map<string, number>();
  const comparativePredicateCounts = new Map<string, number>();

  let sentenceCount = 0;
  let tokenCount = 0;
  let biTokenCount = 0;
  let exactCaseAdpTokenCount = 0;
  let nominalStandardTokenCount = 0;
  let governingPredicateTokenCount = 0;
  let adjectivalPredicateTokenCount = 0;
  let verbalPredicateTokenCount = 0;
  let markerBeforeStandardTokenCount = 0;
  let standardBeforePredicateTokenCount = 0;
  let predicateWithSubjectTokenCount = 0;
  let predicateWithoutSubjectTokenCount = 0;
  let predicateRootTokenCount = 0;
  let predicateNonRootTokenCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const marker of sentence) {
        if (marker.form !== "比") continue;
        biTokenCount += 1;
        increment(biUposRelationCounts, `${marker.upos}\u0000${marker.relation}`);

        if (marker.upos !== "ADP" || marker.relation !== "case") continue;
        exactCaseAdpTokenCount += 1;
        if (marker.head === 0) continue;
        const standard = byId.get(marker.head);
        if (standard === undefined) continue;

        increment(standardHeadUposCounts, standard.upos);
        increment(standardRelationCounts, standard.relation);
        if (
          standard.upos === "NOUN"
          || standard.upos === "PROPN"
          || standard.upos === "PRON"
          || standard.upos === "NUM"
        ) {
          nominalStandardTokenCount += 1;
        }
        if (marker.id < standard.id) markerBeforeStandardTokenCount += 1;

        if (standard.head === 0) continue;
        const predicate = byId.get(standard.head);
        if (predicate === undefined) continue;
        governingPredicateTokenCount += 1;
        increment(governingPredicateUposCounts, predicate.upos);
        increment(governingPredicateRelationCounts, predicate.relation);
        increment(comparativePredicateCounts, lexemeUposKey(predicate.form, predicate.upos));

        if (predicate.upos === "ADJ") adjectivalPredicateTokenCount += 1;
        if (predicate.upos === "VERB") verbalPredicateTokenCount += 1;
        if (standard.id < predicate.id) standardBeforePredicateTokenCount += 1;

        const predicateChildren = childrenByHead.get(predicate.id) ?? [];
        if (hasSubject(predicateChildren)) {
          predicateWithSubjectTokenCount += 1;
        } else {
          predicateWithoutSubjectTokenCount += 1;
        }
        if (predicate.head === 0 || predicate.relation === "root") {
          predicateRootTokenCount += 1;
        } else {
          predicateNonRootTokenCount += 1;
        }
      }
    }
  }

  return {
    contract: COMPARATIVE_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    biTokenCount,
    biUposRelationCounts: sortedRecord(biUposRelationCounts),
    exactCaseAdpTokenCount,
    standardHeadUposCounts: sortedRecord(standardHeadUposCounts),
    standardRelationCounts: sortedRecord(standardRelationCounts),
    nominalStandardTokenCount,
    governingPredicateTokenCount,
    governingPredicateUposCounts: sortedRecord(governingPredicateUposCounts),
    governingPredicateRelationCounts: sortedRecord(governingPredicateRelationCounts),
    comparativePredicateCounts,
    adjectivalPredicateTokenCount,
    verbalPredicateTokenCount,
    markerBeforeStandardTokenCount,
    standardBeforePredicateTokenCount,
    predicateWithSubjectTokenCount,
    predicateWithoutSubjectTokenCount,
    predicateRootTokenCount,
    predicateNonRootTokenCount,
  };
}

export async function auditPinnedComparativeSourceEvidence(): Promise<ComparativeSourceEvidenceSummary> {
  return summarizeComparativeSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
