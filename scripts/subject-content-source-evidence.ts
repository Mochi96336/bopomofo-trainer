import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const SUBJECT_CONTENT_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-csubj-shape-inventory-v1" as const;

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

function isSubjectRelation(token: UdOccurrenceToken): boolean {
  const relation = relationBase(token.relation);
  return relation === "nsubj" || relation === "csubj";
}

export interface SubjectContentSourceEvidenceSummary {
  readonly contract: typeof SUBJECT_CONTENT_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly clausalSubjectTokenCount: number;
  readonly clausalSubjectRelationCounts: Readonly<Record<string, number>>;
  readonly subjectClauseHeadUposCounts: Readonly<Record<string, number>>;
  readonly governingPredicateTokenCount: number;
  readonly governingPredicateUposCounts: Readonly<Record<string, number>>;
  readonly governingPredicateRelationCounts: Readonly<Record<string, number>>;
  readonly governingPredicateCounts: ReadonlyMap<string, number>;
  readonly subjectClauseBeforePredicateTokenCount: number;
  readonly subjectClauseAfterPredicateTokenCount: number;
  readonly subjectClauseWithOvertSubjectTokenCount: number;
  readonly subjectClauseWithoutOvertSubjectTokenCount: number;
  readonly predicateWithAdditionalSubjectTokenCount: number;
  readonly predicateWithoutAdditionalSubjectTokenCount: number;
  readonly predicateRootTokenCount: number;
  readonly predicateNonRootTokenCount: number;
}

export function summarizeSubjectContentSourceEvidence(
  sources: readonly string[],
): SubjectContentSourceEvidenceSummary {
  const clausalSubjectRelationCounts = new Map<string, number>();
  const subjectClauseHeadUposCounts = new Map<string, number>();
  const governingPredicateUposCounts = new Map<string, number>();
  const governingPredicateRelationCounts = new Map<string, number>();
  const governingPredicateCounts = new Map<string, number>();

  let sentenceCount = 0;
  let tokenCount = 0;
  let clausalSubjectTokenCount = 0;
  let governingPredicateTokenCount = 0;
  let subjectClauseBeforePredicateTokenCount = 0;
  let subjectClauseAfterPredicateTokenCount = 0;
  let subjectClauseWithOvertSubjectTokenCount = 0;
  let subjectClauseWithoutOvertSubjectTokenCount = 0;
  let predicateWithAdditionalSubjectTokenCount = 0;
  let predicateWithoutAdditionalSubjectTokenCount = 0;
  let predicateRootTokenCount = 0;
  let predicateNonRootTokenCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const subjectClauseHead of sentence) {
        if (relationBase(subjectClauseHead.relation) !== "csubj") continue;

        clausalSubjectTokenCount += 1;
        increment(clausalSubjectRelationCounts, subjectClauseHead.relation);
        increment(subjectClauseHeadUposCounts, subjectClauseHead.upos);

        if (subjectClauseHead.head === 0) continue;
        const predicate = byId.get(subjectClauseHead.head);
        if (predicate === undefined) continue;

        governingPredicateTokenCount += 1;
        increment(governingPredicateUposCounts, predicate.upos);
        increment(governingPredicateRelationCounts, predicate.relation);
        increment(governingPredicateCounts, lexemeUposKey(predicate.form, predicate.upos));

        if (subjectClauseHead.id < predicate.id) {
          subjectClauseBeforePredicateTokenCount += 1;
        } else {
          subjectClauseAfterPredicateTokenCount += 1;
        }

        const clauseChildren = childrenByHead.get(subjectClauseHead.id) ?? [];
        if (clauseChildren.some(isSubjectRelation)) {
          subjectClauseWithOvertSubjectTokenCount += 1;
        } else {
          subjectClauseWithoutOvertSubjectTokenCount += 1;
        }

        const predicateChildren = childrenByHead.get(predicate.id) ?? [];
        const hasAdditionalSubject = predicateChildren.some((child) =>
          child.id !== subjectClauseHead.id && isSubjectRelation(child));
        if (hasAdditionalSubject) {
          predicateWithAdditionalSubjectTokenCount += 1;
        } else {
          predicateWithoutAdditionalSubjectTokenCount += 1;
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
    contract: SUBJECT_CONTENT_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    clausalSubjectTokenCount,
    clausalSubjectRelationCounts: sortedRecord(clausalSubjectRelationCounts),
    subjectClauseHeadUposCounts: sortedRecord(subjectClauseHeadUposCounts),
    governingPredicateTokenCount,
    governingPredicateUposCounts: sortedRecord(governingPredicateUposCounts),
    governingPredicateRelationCounts: sortedRecord(governingPredicateRelationCounts),
    governingPredicateCounts,
    subjectClauseBeforePredicateTokenCount,
    subjectClauseAfterPredicateTokenCount,
    subjectClauseWithOvertSubjectTokenCount,
    subjectClauseWithoutOvertSubjectTokenCount,
    predicateWithAdditionalSubjectTokenCount,
    predicateWithoutAdditionalSubjectTokenCount,
    predicateRootTokenCount,
    predicateNonRootTokenCount,
  };
}

export async function auditPinnedSubjectContentSourceEvidence():
Promise<SubjectContentSourceEvidenceSummary> {
  return summarizeSubjectContentSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
