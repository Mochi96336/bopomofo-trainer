import { createHash } from "node:crypto";
import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const YOUGUAN_RELATIONAL_CCOMP_SOURCE_EVIDENCE_CONTRACT =
  "same-root-youguan-case-ccomp-v1" as const;

const TARGET_FORM = "有關";
const TARGET_UPOS = "ADJ";
const REVIEWED_CASE_FORMS = new Set(["與", "和"]);

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
  const base = relationBase(token.relation);
  return base === "nsubj" || base === "csubj";
}

export interface ReviewedYouguanRelationalCcompOccurrence {
  readonly sourceIndex: number;
  readonly sentenceIndex: number;
  readonly sentence: string;
  readonly governorId: number;
  readonly governorRelation: string;
  readonly matrixSubjectCount: number;
  readonly ccompId: number;
  readonly ccompForm: string;
  readonly ccompUpos: string;
  readonly ccompSubjectCount: number;
  readonly caseForm: "與" | "和";
}

export interface YouguanRelationalCcompSourceEvidenceSummary {
  readonly contract: typeof YOUGUAN_RELATIONAL_CCOMP_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly targetOccurrenceCount: number;
  readonly targetRelationCounts: Readonly<Record<string, number>>;
  readonly targetRootCount: number;
  readonly targetNonRootCount: number;
  readonly targetWithDirectCcompCount: number;
  readonly targetWithoutDirectCcompCount: number;
  readonly targetWithMatrixSubjectCount: number;
  readonly targetWithoutMatrixSubjectCount: number;
  readonly reviewedSignatureCount: number;
  readonly reviewedCaseFormCounts: Readonly<Record<string, number>>;
  readonly reviewedCcompHeadUposCounts: Readonly<Record<string, number>>;
  readonly reviewedWithMatrixSubjectCount: number;
  readonly reviewedWithoutMatrixSubjectCount: number;
  readonly reviewedWithEmbeddedSubjectCount: number;
  readonly reviewedWithoutEmbeddedSubjectCount: number;
  readonly reviewedOccurrenceDigest: string;
  readonly reviewedOccurrences: readonly ReviewedYouguanRelationalCcompOccurrence[];
}

export function summarizeYouguanRelationalCcompSourceEvidence(
  sources: readonly string[],
): YouguanRelationalCcompSourceEvidenceSummary {
  const targetRelationCounts = new Map<string, number>();
  const reviewedCaseFormCounts = new Map<string, number>();
  const reviewedCcompHeadUposCounts = new Map<string, number>();
  const reviewedOccurrences: ReviewedYouguanRelationalCcompOccurrence[] = [];

  let sentenceCount = 0;
  let tokenCount = 0;
  let targetOccurrenceCount = 0;
  let targetRootCount = 0;
  let targetNonRootCount = 0;
  let targetWithDirectCcompCount = 0;
  let targetWithoutDirectCcompCount = 0;
  let targetWithMatrixSubjectCount = 0;
  let targetWithoutMatrixSubjectCount = 0;
  let reviewedWithMatrixSubjectCount = 0;
  let reviewedWithoutMatrixSubjectCount = 0;
  let reviewedWithEmbeddedSubjectCount = 0;
  let reviewedWithoutEmbeddedSubjectCount = 0;

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    const sentences = parseUdOccurrenceSentences(source);
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      const sentence = sentences[sentenceIndex]!;
      sentenceCount += 1;
      tokenCount += sentence.length;
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const governor of sentence) {
        if (governor.form !== TARGET_FORM || governor.upos !== TARGET_UPOS) continue;

        targetOccurrenceCount += 1;
        increment(targetRelationCounts, governor.relation);

        const isRoot = governor.head === 0 || governor.relation === "root";
        if (isRoot) targetRootCount += 1;
        else targetNonRootCount += 1;

        const governorChildren = childrenByHead.get(governor.id) ?? [];
        const matrixSubjects = governorChildren.filter(isSubjectRelation);
        if (matrixSubjects.length > 0) targetWithMatrixSubjectCount += 1;
        else targetWithoutMatrixSubjectCount += 1;

        const ccomps = governorChildren.filter((child) => relationBase(child.relation) === "ccomp");
        if (ccomps.length > 0) targetWithDirectCcompCount += 1;
        else targetWithoutDirectCcompCount += 1;

        if (!isRoot || ccomps.length !== 1) continue;
        const ccomp = ccomps[0]!;
        if (ccomp.id >= governor.id) continue;

        const ccompChildren = childrenByHead.get(ccomp.id) ?? [];
        const cases = ccompChildren.filter((child) => relationBase(child.relation) === "case");
        if (cases.length !== 1 || !REVIEWED_CASE_FORMS.has(cases[0]!.form)) continue;

        const copulas = governorChildren.filter((child) => relationBase(child.relation) === "cop");
        if (copulas.length > 0) continue;

        const caseForm = cases[0]!.form as "與" | "和";
        const ccompSubjects = ccompChildren.filter(isSubjectRelation);
        increment(reviewedCaseFormCounts, caseForm);
        increment(reviewedCcompHeadUposCounts, ccomp.upos);
        if (matrixSubjects.length > 0) reviewedWithMatrixSubjectCount += 1;
        else reviewedWithoutMatrixSubjectCount += 1;
        if (ccompSubjects.length > 0) reviewedWithEmbeddedSubjectCount += 1;
        else reviewedWithoutEmbeddedSubjectCount += 1;

        reviewedOccurrences.push({
          sourceIndex,
          sentenceIndex,
          sentence: sentence.map((token) => token.form).join(""),
          governorId: governor.id,
          governorRelation: governor.relation,
          matrixSubjectCount: matrixSubjects.length,
          ccompId: ccomp.id,
          ccompForm: ccomp.form,
          ccompUpos: ccomp.upos,
          ccompSubjectCount: ccompSubjects.length,
          caseForm,
        });
      }
    }
  }

  const digestPayload = reviewedOccurrences.map((item) => ({
    sourceIndex: item.sourceIndex,
    sentenceIndex: item.sentenceIndex,
    governorId: item.governorId,
    ccompId: item.ccompId,
    ccompForm: item.ccompForm,
    ccompUpos: item.ccompUpos,
    caseForm: item.caseForm,
  }));
  const reviewedOccurrenceDigest = createHash("sha256")
    .update(JSON.stringify(digestPayload), "utf8")
    .digest("hex");

  return {
    contract: YOUGUAN_RELATIONAL_CCOMP_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    targetOccurrenceCount,
    targetRelationCounts: sortedRecord(targetRelationCounts),
    targetRootCount,
    targetNonRootCount,
    targetWithDirectCcompCount,
    targetWithoutDirectCcompCount,
    targetWithMatrixSubjectCount,
    targetWithoutMatrixSubjectCount,
    reviewedSignatureCount: reviewedOccurrences.length,
    reviewedCaseFormCounts: sortedRecord(reviewedCaseFormCounts),
    reviewedCcompHeadUposCounts: sortedRecord(reviewedCcompHeadUposCounts),
    reviewedWithMatrixSubjectCount,
    reviewedWithoutMatrixSubjectCount,
    reviewedWithEmbeddedSubjectCount,
    reviewedWithoutEmbeddedSubjectCount,
    reviewedOccurrenceDigest,
    reviewedOccurrences,
  };
}

export async function auditPinnedYouguanRelationalCcompSourceEvidence():
Promise<YouguanRelationalCcompSourceEvidenceSummary> {
  return summarizeYouguanRelationalCcompSourceEvidence(
    await loadPinnedUdGsdOccurrenceSources(),
  );
}
