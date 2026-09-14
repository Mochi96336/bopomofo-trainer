import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
} from "./ud-occurrence-source.js";

/**
 * Pinned-source observation contract for the Clause Model V2 argument-realization axis.
 *
 * This contract deliberately describes same-predicate-occurrence surface realization.
 * It is not a lexical valency contract and must not be projected into `intransitive`,
 * `ambitransitive`, `subject-omissible`, or `object-omissible` lexical features.
 */
export const ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-argument-realization-alternation-v1" as const;

/** Diagnostic review threshold, not a Mandarin omission probability or product prior. */
export const ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_COUNT = 2;
export const ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_SHARE = 0.10;

export interface ArgumentRealizationFormEvidence {
  readonly form: string;
  readonly verbOccurrenceCount: number;
  readonly subjectOvertCount: number;
  readonly subjectAbsentCount: number;
  readonly directObjectOvertCount: number;
  readonly directObjectAbsentCount: number;
  readonly indirectObjectOvertCount: number;
  readonly subjectAlternationObserved: boolean;
  readonly subjectAlternationReviewedFrontier: boolean;
  readonly directObjectAlternationObserved: boolean;
  readonly directObjectAlternationReviewedFrontier: boolean;
}

export interface ArgumentRealizationSourceEvidenceSummary {
  readonly contract: typeof ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT;
  readonly diagnosticThreshold: {
    readonly minimumCountEachState: typeof ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_COUNT;
    readonly minimumShareEachState: typeof ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_SHARE;
  };
  readonly verbOccurrenceCount: number;
  readonly verbFormCount: number;
  readonly subjectAlternationObservedFormCount: number;
  readonly subjectAlternationReviewedFrontierFormCount: number;
  readonly directObjectAlternationObservedFormCount: number;
  readonly directObjectAlternationReviewedFrontierFormCount: number;
  readonly bothReviewedFrontiersFormCount: number;
  readonly subjectReviewedFrontierOvertTokenCount: number;
  readonly subjectReviewedFrontierAbsentTokenCount: number;
  readonly directObjectReviewedFrontierOvertTokenCount: number;
  readonly directObjectReviewedFrontierAbsentTokenCount: number;
  readonly forms: readonly ArgumentRealizationFormEvidence[];
}

interface MutableFormEvidence {
  verbOccurrenceCount: number;
  subjectOvertCount: number;
  subjectAbsentCount: number;
  directObjectOvertCount: number;
  directObjectAbsentCount: number;
  indirectObjectOvertCount: number;
}

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function reachesReviewedAlternationFrontier(
  overtCount: number,
  absentCount: number,
  occurrenceCount: number,
): boolean {
  if (occurrenceCount <= 0) return false;
  return overtCount >= ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_COUNT
    && absentCount >= ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_COUNT
    && overtCount / occurrenceCount >= ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_SHARE
    && absentCount / occurrenceCount >= ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_SHARE;
}

export function summarizeArgumentRealizationSourceEvidence(
  sources: readonly string[],
): ArgumentRealizationSourceEvidenceSummary {
  const byForm = new Map<string, MutableFormEvidence>();
  let verbOccurrenceCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      const childrenByHead = indexUdOccurrenceChildren(sentence);
      for (const token of sentence) {
        if (token.upos !== "VERB") continue;
        verbOccurrenceCount += 1;

        const children = childrenByHead.get(token.id) ?? [];
        const subjectOvert = children.some((child) => {
          const relation = relationBase(child.relation);
          return relation === "nsubj" || relation === "csubj";
        });
        const directObjectOvert = children.some(
          (child) => relationBase(child.relation) === "obj",
        );
        const indirectObjectOvert = children.some(
          (child) => relationBase(child.relation) === "iobj",
        );

        const evidence = byForm.get(token.form) ?? {
          verbOccurrenceCount: 0,
          subjectOvertCount: 0,
          subjectAbsentCount: 0,
          directObjectOvertCount: 0,
          directObjectAbsentCount: 0,
          indirectObjectOvertCount: 0,
        };
        evidence.verbOccurrenceCount += 1;
        evidence.subjectOvertCount += Number(subjectOvert);
        evidence.subjectAbsentCount += Number(!subjectOvert);
        evidence.directObjectOvertCount += Number(directObjectOvert);
        evidence.directObjectAbsentCount += Number(!directObjectOvert);
        evidence.indirectObjectOvertCount += Number(indirectObjectOvert);
        byForm.set(token.form, evidence);
      }
    }
  }

  const forms: ArgumentRealizationFormEvidence[] = [...byForm.entries()]
    .map(([form, evidence]) => ({
      form,
      ...evidence,
      subjectAlternationObserved:
        evidence.subjectOvertCount > 0 && evidence.subjectAbsentCount > 0,
      subjectAlternationReviewedFrontier: reachesReviewedAlternationFrontier(
        evidence.subjectOvertCount,
        evidence.subjectAbsentCount,
        evidence.verbOccurrenceCount,
      ),
      directObjectAlternationObserved:
        evidence.directObjectOvertCount > 0 && evidence.directObjectAbsentCount > 0,
      directObjectAlternationReviewedFrontier: reachesReviewedAlternationFrontier(
        evidence.directObjectOvertCount,
        evidence.directObjectAbsentCount,
        evidence.verbOccurrenceCount,
      ),
    }))
    .sort((left, right) => left.form.localeCompare(right.form, "zh-Hant"));

  const subjectReviewed = forms.filter((item) => item.subjectAlternationReviewedFrontier);
  const directObjectReviewed = forms.filter(
    (item) => item.directObjectAlternationReviewedFrontier,
  );

  return {
    contract: ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT,
    diagnosticThreshold: {
      minimumCountEachState: ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_COUNT,
      minimumShareEachState: ARGUMENT_REALIZATION_ALTERNATION_MINIMUM_SHARE,
    },
    verbOccurrenceCount,
    verbFormCount: forms.length,
    subjectAlternationObservedFormCount:
      forms.filter((item) => item.subjectAlternationObserved).length,
    subjectAlternationReviewedFrontierFormCount: subjectReviewed.length,
    directObjectAlternationObservedFormCount:
      forms.filter((item) => item.directObjectAlternationObserved).length,
    directObjectAlternationReviewedFrontierFormCount: directObjectReviewed.length,
    bothReviewedFrontiersFormCount: forms.filter(
      (item) => item.subjectAlternationReviewedFrontier
        && item.directObjectAlternationReviewedFrontier,
    ).length,
    subjectReviewedFrontierOvertTokenCount:
      subjectReviewed.reduce((sum, item) => sum + item.subjectOvertCount, 0),
    subjectReviewedFrontierAbsentTokenCount:
      subjectReviewed.reduce((sum, item) => sum + item.subjectAbsentCount, 0),
    directObjectReviewedFrontierOvertTokenCount:
      directObjectReviewed.reduce((sum, item) => sum + item.directObjectOvertCount, 0),
    directObjectReviewedFrontierAbsentTokenCount:
      directObjectReviewed.reduce((sum, item) => sum + item.directObjectAbsentCount, 0),
    forms,
  };
}

export async function auditPinnedArgumentRealizationSourceEvidence(): Promise<ArgumentRealizationSourceEvidenceSummary> {
  return summarizeArgumentRealizationSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
