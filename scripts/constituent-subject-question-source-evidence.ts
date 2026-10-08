import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const CONSTITUENT_SUBJECT_QUESTION_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-licensed-wh-direct-subject-shape-inventory-v1" as const;

/**
 * Exact forms currently licensed by questionType:constituent.
 *
 * This source audit intentionally measures the current lexical boundary rather
 * than inferring a broader Mandarin interrogative lexicon from corpus counts.
 */
export const CURRENT_CONSTITUENT_QUESTION_FORMS = new Set([
  "誰", "什麼", "甚麼", "哪", "哪個", "哪些", "哪裡", "哪兒",
  "何", "何人", "何處", "何時", "幾", "多少",
]);

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function isSubjectRelation(token: UdOccurrenceToken): boolean {
  const relation = relationBase(token.relation);
  return relation === "nsubj" || relation === "csubj";
}

function increment(target: Map<string, number>, key: string): void {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function sortedRecord(values: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(
    [...values].sort(([left], [right]) => left.localeCompare(right, "zh-Hant")),
  );
}

export interface ConstituentSubjectQuestionSourceEvidenceSummary {
  readonly contract: typeof CONSTITUENT_SUBJECT_QUESTION_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly interrogativeTokenCount: number;
  readonly interrogativeFormCounts: Readonly<Record<string, number>>;
  readonly interrogativeUposCounts: Readonly<Record<string, number>>;
  readonly interrogativeRelationCounts: Readonly<Record<string, number>>;
  readonly directSubjectTokenCount: number;
  readonly directSubjectFormCounts: Readonly<Record<string, number>>;
  readonly directSubjectUposCounts: Readonly<Record<string, number>>;
  readonly directSubjectRelationCounts: Readonly<Record<string, number>>;
  readonly directSubjectIdentityCounts: ReadonlyMap<string, number>;
  readonly governingHeadTokenCount: number;
  readonly governingHeadUposCounts: Readonly<Record<string, number>>;
  readonly governingHeadRelationCounts: Readonly<Record<string, number>>;
  readonly governingHeadIdentityCounts: ReadonlyMap<string, number>;
  readonly governingHeadChildRelationCounts: Readonly<Record<string, number>>;
  readonly subjectBeforeHeadTokenCount: number;
  readonly subjectAfterHeadTokenCount: number;
  readonly governingHeadWithAdditionalSubjectTokenCount: number;
  readonly governingHeadWithoutAdditionalSubjectTokenCount: number;
  readonly governingHeadWithObjectTokenCount: number;
  readonly governingHeadWithoutObjectTokenCount: number;
  readonly governingHeadWithIndirectObjectTokenCount: number;
  readonly governingHeadWithCopulaTokenCount: number;
  readonly governingHeadWithClausalComplementTokenCount: number;
  readonly governingHeadRootTokenCount: number;
  readonly governingHeadNonRootTokenCount: number;
}

export function summarizeConstituentSubjectQuestionSourceEvidence(
  sources: readonly string[],
): ConstituentSubjectQuestionSourceEvidenceSummary {
  const interrogativeFormCounts = new Map<string, number>();
  const interrogativeUposCounts = new Map<string, number>();
  const interrogativeRelationCounts = new Map<string, number>();
  const directSubjectFormCounts = new Map<string, number>();
  const directSubjectUposCounts = new Map<string, number>();
  const directSubjectRelationCounts = new Map<string, number>();
  const directSubjectIdentityCounts = new Map<string, number>();
  const governingHeadUposCounts = new Map<string, number>();
  const governingHeadRelationCounts = new Map<string, number>();
  const governingHeadIdentityCounts = new Map<string, number>();
  const governingHeadChildRelationCounts = new Map<string, number>();

  let sentenceCount = 0;
  let tokenCount = 0;
  let interrogativeTokenCount = 0;
  let directSubjectTokenCount = 0;
  let governingHeadTokenCount = 0;
  let subjectBeforeHeadTokenCount = 0;
  let subjectAfterHeadTokenCount = 0;
  let governingHeadWithAdditionalSubjectTokenCount = 0;
  let governingHeadWithoutAdditionalSubjectTokenCount = 0;
  let governingHeadWithObjectTokenCount = 0;
  let governingHeadWithoutObjectTokenCount = 0;
  let governingHeadWithIndirectObjectTokenCount = 0;
  let governingHeadWithCopulaTokenCount = 0;
  let governingHeadWithClausalComplementTokenCount = 0;
  let governingHeadRootTokenCount = 0;
  let governingHeadNonRootTokenCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const token of sentence) {
        if (!CURRENT_CONSTITUENT_QUESTION_FORMS.has(token.form)) continue;

        interrogativeTokenCount += 1;
        increment(interrogativeFormCounts, token.form);
        increment(interrogativeUposCounts, token.upos);
        increment(interrogativeRelationCounts, token.relation);

        if (!isSubjectRelation(token)) continue;

        directSubjectTokenCount += 1;
        increment(directSubjectFormCounts, token.form);
        increment(directSubjectUposCounts, token.upos);
        increment(directSubjectRelationCounts, token.relation);
        increment(directSubjectIdentityCounts, lexemeUposKey(token.form, token.upos));

        if (token.head === 0) continue;
        const head = byId.get(token.head);
        if (head === undefined) continue;

        governingHeadTokenCount += 1;
        increment(governingHeadUposCounts, head.upos);
        increment(governingHeadRelationCounts, head.relation);
        increment(governingHeadIdentityCounts, lexemeUposKey(head.form, head.upos));

        if (token.id < head.id) subjectBeforeHeadTokenCount += 1;
        else subjectAfterHeadTokenCount += 1;

        const children = childrenByHead.get(head.id) ?? [];
        for (const child of children) increment(governingHeadChildRelationCounts, child.relation);

        const hasAdditionalSubject = children.some((child) =>
          child.id !== token.id && isSubjectRelation(child));
        if (hasAdditionalSubject) governingHeadWithAdditionalSubjectTokenCount += 1;
        else governingHeadWithoutAdditionalSubjectTokenCount += 1;

        const hasObject = children.some((child) => relationBase(child.relation) === "obj");
        if (hasObject) governingHeadWithObjectTokenCount += 1;
        else governingHeadWithoutObjectTokenCount += 1;

        if (children.some((child) => relationBase(child.relation) === "iobj")) {
          governingHeadWithIndirectObjectTokenCount += 1;
        }
        if (children.some((child) => relationBase(child.relation) === "cop")) {
          governingHeadWithCopulaTokenCount += 1;
        }
        if (children.some((child) => {
          const relation = relationBase(child.relation);
          return relation === "ccomp" || relation === "xcomp";
        })) {
          governingHeadWithClausalComplementTokenCount += 1;
        }

        if (head.head === 0 || head.relation === "root") governingHeadRootTokenCount += 1;
        else governingHeadNonRootTokenCount += 1;
      }
    }
  }

  return {
    contract: CONSTITUENT_SUBJECT_QUESTION_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    interrogativeTokenCount,
    interrogativeFormCounts: sortedRecord(interrogativeFormCounts),
    interrogativeUposCounts: sortedRecord(interrogativeUposCounts),
    interrogativeRelationCounts: sortedRecord(interrogativeRelationCounts),
    directSubjectTokenCount,
    directSubjectFormCounts: sortedRecord(directSubjectFormCounts),
    directSubjectUposCounts: sortedRecord(directSubjectUposCounts),
    directSubjectRelationCounts: sortedRecord(directSubjectRelationCounts),
    directSubjectIdentityCounts,
    governingHeadTokenCount,
    governingHeadUposCounts: sortedRecord(governingHeadUposCounts),
    governingHeadRelationCounts: sortedRecord(governingHeadRelationCounts),
    governingHeadIdentityCounts,
    governingHeadChildRelationCounts: sortedRecord(governingHeadChildRelationCounts),
    subjectBeforeHeadTokenCount,
    subjectAfterHeadTokenCount,
    governingHeadWithAdditionalSubjectTokenCount,
    governingHeadWithoutAdditionalSubjectTokenCount,
    governingHeadWithObjectTokenCount,
    governingHeadWithoutObjectTokenCount,
    governingHeadWithIndirectObjectTokenCount,
    governingHeadWithCopulaTokenCount,
    governingHeadWithClausalComplementTokenCount,
    governingHeadRootTokenCount,
    governingHeadNonRootTokenCount,
  };
}

export async function auditPinnedConstituentSubjectQuestionSourceEvidence():
Promise<ConstituentSubjectQuestionSourceEvidenceSummary> {
  return summarizeConstituentSubjectQuestionSourceEvidence(
    await loadPinnedUdGsdOccurrenceSources(),
  );
}
