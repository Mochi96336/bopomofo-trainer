import { createHash } from "node:crypto";
import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const QUOTED_CONTENT_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-corner-quote-span-attachment-v1" as const;

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

function digestMap(values: ReadonlyMap<string, number>): string {
  return createHash("sha256")
    .update(JSON.stringify([...values].sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))), "utf8")
    .digest("hex");
}

function isSubject(token: UdOccurrenceToken): boolean {
  const base = relationBase(token.relation);
  return base === "nsubj" || base === "csubj";
}

interface QuoteSpan {
  readonly openId: number;
  readonly closeId: number;
}

function cornerQuoteSpans(sentence: readonly UdOccurrenceToken[]): readonly QuoteSpan[] {
  const stack: number[] = [];
  const spans: QuoteSpan[] = [];
  for (const token of sentence) {
    if (token.form === "「") {
      stack.push(token.id);
      continue;
    }
    if (token.form !== "」") continue;
    const openId = stack.pop();
    if (openId !== undefined && openId < token.id) {
      spans.push({ openId, closeId: token.id });
    }
  }
  return spans.sort((a, b) => a.openId - b.openId || a.closeId - b.closeId);
}

export interface QuotedContentOccurrence {
  readonly sourceIndex: number;
  readonly sentenceIndex: number;
  readonly sentence: string;
  readonly openId: number;
  readonly closeId: number;
  readonly boundaryRootCount: number;
  readonly quotedRootId: number | null;
  readonly quotedRootForm: string | null;
  readonly quotedRootUpos: string | null;
  readonly quotedRootRelation: string | null;
  readonly quotedRootSubjectCount: number;
  readonly quotedRootHasCopula: boolean;
  readonly quotedRootClauseLike: boolean;
  readonly governorId: number | null;
  readonly governorForm: string | null;
  readonly governorUpos: string | null;
  readonly governorRelation: string | null;
  readonly governorIsRoot: boolean | null;
  readonly governorSubjectCount: number;
  readonly governorHasObject: boolean;
  readonly governorHasOtherCcomp: boolean;
  readonly governorHasXcomp: boolean;
  readonly governorHasOtherParataxis: boolean;
  readonly quoteBeforeGovernor: boolean | null;
}

export interface QuotedContentSourceEvidenceSummary {
  readonly contract: typeof QUOTED_CONTENT_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly quotePunctuationFormCounts: Readonly<Record<string, number>>;
  readonly cornerQuoteSpanCount: number;
  readonly spanWithNoBoundaryRootCount: number;
  readonly spanWithSingleBoundaryRootCount: number;
  readonly spanWithMultipleBoundaryRootsCount: number;
  readonly standaloneQuotedRootCount: number;
  readonly externallyAttachedQuotedRootCount: number;
  readonly quotedRootRelationCounts: Readonly<Record<string, number>>;
  readonly quotedRootUposCounts: Readonly<Record<string, number>>;
  readonly quotedRootIdentityCounts: ReadonlyMap<string, number>;
  readonly governorUposCounts: Readonly<Record<string, number>>;
  readonly governorRelationCounts: Readonly<Record<string, number>>;
  readonly governorIdentityCounts: ReadonlyMap<string, number>;
  readonly governorRootCount: number;
  readonly governorNonRootCount: number;
  readonly governorWithSubjectCount: number;
  readonly governorWithoutSubjectCount: number;
  readonly governorWithNominalSubjectCount: number;
  readonly governorWithClausalSubjectCount: number;
  readonly governorWithObjectCount: number;
  readonly governorWithOtherCcompCount: number;
  readonly governorWithXcompCount: number;
  readonly governorWithOtherParataxisCount: number;
  readonly quotedRootWithSubjectCount: number;
  readonly quotedRootWithoutSubjectCount: number;
  readonly clauseLikeQuotedRootCount: number;
  readonly clauseLikeExternallyAttachedCount: number;
  readonly clauseLikeRelationCounts: Readonly<Record<string, number>>;
  readonly clauseLikeUposCounts: Readonly<Record<string, number>>;
  readonly clauseLikeGovernorUposCounts: Readonly<Record<string, number>>;
  readonly clauseLikeGovernorWithSubjectCount: number;
  readonly clauseLikeGovernorWithObjectCount: number;
  readonly clauseLikeGovernorWithOtherCcompCount: number;
  readonly clauseLikeGovernorWithXcompCount: number;
  readonly clauseLikeGovernorWithOtherParataxisCount: number;
  readonly clauseLikeQuoteBeforeGovernorCount: number;
  readonly clauseLikeQuoteAfterGovernorCount: number;
  readonly directQuoteCandidateCount: number;
  readonly directQuoteRelationCounts: Readonly<Record<string, number>>;
  readonly directQuoteGovernorUposCounts: Readonly<Record<string, number>>;
  readonly directQuoteGovernorRootCount: number;
  readonly directQuoteGovernorNonRootCount: number;
  readonly directQuoteGovernorWithSubjectCount: number;
  readonly directQuoteGovernorWithNominalSubjectCount: number;
  readonly directQuoteGovernorWithClausalSubjectCount: number;
  readonly directQuoteGovernorWithObjectCount: number;
  readonly directQuoteGovernorWithOtherCcompCount: number;
  readonly directQuoteGovernorWithXcompCount: number;
  readonly directQuoteGovernorWithOtherParataxisCount: number;
  readonly directQuoteBeforeGovernorCount: number;
  readonly directQuoteAfterGovernorCount: number;
  readonly quoteBeforeGovernorCount: number;
  readonly quoteAfterGovernorCount: number;
  readonly quotedRootIdentityDigest: string;
  readonly governorIdentityDigest: string;
  readonly occurrences: readonly QuotedContentOccurrence[];
}

export function summarizeQuotedContentSourceEvidence(
  sources: readonly string[],
): QuotedContentSourceEvidenceSummary {
  const quotePunctuationFormCounts = new Map<string, number>();
  const quotedRootRelationCounts = new Map<string, number>();
  const quotedRootUposCounts = new Map<string, number>();
  const quotedRootIdentityCounts = new Map<string, number>();
  const governorUposCounts = new Map<string, number>();
  const governorRelationCounts = new Map<string, number>();
  const governorIdentityCounts = new Map<string, number>();
  const clauseLikeRelationCounts = new Map<string, number>();
  const clauseLikeUposCounts = new Map<string, number>();
  const clauseLikeGovernorUposCounts = new Map<string, number>();
  const directQuoteRelationCounts = new Map<string, number>();
  const directQuoteGovernorUposCounts = new Map<string, number>();
  const occurrences: QuotedContentOccurrence[] = [];

  let sentenceCount = 0;
  let tokenCount = 0;
  let cornerQuoteSpanCount = 0;
  let spanWithNoBoundaryRootCount = 0;
  let spanWithSingleBoundaryRootCount = 0;
  let spanWithMultipleBoundaryRootsCount = 0;
  let standaloneQuotedRootCount = 0;
  let externallyAttachedQuotedRootCount = 0;
  let governorRootCount = 0;
  let governorNonRootCount = 0;
  let governorWithSubjectCount = 0;
  let governorWithoutSubjectCount = 0;
  let governorWithNominalSubjectCount = 0;
  let governorWithClausalSubjectCount = 0;
  let governorWithObjectCount = 0;
  let governorWithOtherCcompCount = 0;
  let governorWithXcompCount = 0;
  let governorWithOtherParataxisCount = 0;
  let quotedRootWithSubjectCount = 0;
  let quotedRootWithoutSubjectCount = 0;
  let clauseLikeQuotedRootCount = 0;
  let clauseLikeExternallyAttachedCount = 0;
  let clauseLikeGovernorWithSubjectCount = 0;
  let clauseLikeGovernorWithObjectCount = 0;
  let clauseLikeGovernorWithOtherCcompCount = 0;
  let clauseLikeGovernorWithXcompCount = 0;
  let clauseLikeGovernorWithOtherParataxisCount = 0;
  let clauseLikeQuoteBeforeGovernorCount = 0;
  let clauseLikeQuoteAfterGovernorCount = 0;
  let directQuoteCandidateCount = 0;
  let directQuoteGovernorRootCount = 0;
  let directQuoteGovernorNonRootCount = 0;
  let directQuoteGovernorWithSubjectCount = 0;
  let directQuoteGovernorWithNominalSubjectCount = 0;
  let directQuoteGovernorWithClausalSubjectCount = 0;
  let directQuoteGovernorWithObjectCount = 0;
  let directQuoteGovernorWithOtherCcompCount = 0;
  let directQuoteGovernorWithXcompCount = 0;
  let directQuoteGovernorWithOtherParataxisCount = 0;
  let directQuoteBeforeGovernorCount = 0;
  let directQuoteAfterGovernorCount = 0;
  let quoteBeforeGovernorCount = 0;
  let quoteAfterGovernorCount = 0;

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const sentences = parseUdOccurrenceSentences(sources[sourceIndex]!);
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      const sentence = sentences[sentenceIndex]!;
      sentenceCount += 1;
      tokenCount += sentence.length;

      for (const token of sentence) {
        if (["「", "」", "“", "”", "‘", "’", "『", "』"].includes(token.form)) {
          increment(quotePunctuationFormCounts, token.form);
        }
      }

      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const span of cornerQuoteSpans(sentence)) {
        cornerQuoteSpanCount += 1;
        const inside = sentence.filter((token) =>
          token.id > span.openId && token.id < span.closeId);
        const insideIds = new Set(inside.map((token) => token.id));
        const boundaryRoots = inside.filter((token) =>
          token.head === 0 || !insideIds.has(token.head));

        if (boundaryRoots.length === 0) spanWithNoBoundaryRootCount += 1;
        else if (boundaryRoots.length === 1) spanWithSingleBoundaryRootCount += 1;
        else spanWithMultipleBoundaryRootsCount += 1;

        const quotedRoot = boundaryRoots.length === 1 ? boundaryRoots[0]! : null;
        const quotedChildren = quotedRoot === null
          ? []
          : childrenByHead.get(quotedRoot.id) ?? [];
        const quotedSubjects = quotedChildren.filter(isSubject);
        const quotedRootHasCopula = quotedChildren.some(
          (child) => relationBase(child.relation) === "cop",
        );
        // Structural proxy for content the current Clause inventory can
        // plausibly realize without inventing a new fragment grammar: verbal
        // roots may omit Subject, while non-verbal predicate frames require an
        // overt Subject. This deliberately excludes bare quoted names/titles.
        const quotedRootClauseLike = quotedRoot !== null
          && (quotedRoot.upos === "VERB" || quotedSubjects.length > 0);
        if (quotedRoot !== null) {
          increment(quotedRootRelationCounts, quotedRoot.relation);
          increment(quotedRootUposCounts, quotedRoot.upos);
          increment(quotedRootIdentityCounts, lexemeUposKey(quotedRoot.form, quotedRoot.upos));
          if (quotedSubjects.length > 0) quotedRootWithSubjectCount += 1;
          else quotedRootWithoutSubjectCount += 1;
          if (quotedRootClauseLike) {
            clauseLikeQuotedRootCount += 1;
            increment(clauseLikeRelationCounts, quotedRoot.relation);
            increment(clauseLikeUposCounts, quotedRoot.upos);
          }
        }

        const governor = quotedRoot === null || quotedRoot.head === 0
          ? null
          : byId.get(quotedRoot.head) ?? null;

        let governorSubjects: readonly UdOccurrenceToken[] = [];
        let governorHasObject = false;
        let governorHasOtherCcomp = false;
        let governorHasXcomp = false;
        let governorHasOtherParataxis = false;
        let quoteBeforeGovernor: boolean | null = null;

        if (quotedRoot !== null && governor === null) {
          standaloneQuotedRootCount += 1;
        } else if (quotedRoot !== null && governor !== null) {
          externallyAttachedQuotedRootCount += 1;
          if (quotedRootClauseLike) {
            clauseLikeExternallyAttachedCount += 1;
            increment(clauseLikeGovernorUposCounts, governor.upos);
          }
          increment(governorUposCounts, governor.upos);
          increment(governorRelationCounts, governor.relation);
          increment(governorIdentityCounts, lexemeUposKey(governor.form, governor.upos));
          if (governor.head === 0 || governor.relation === "root") governorRootCount += 1;
          else governorNonRootCount += 1;

          const governorChildren = childrenByHead.get(governor.id) ?? [];
          governorSubjects = governorChildren.filter((child) =>
            child.id !== quotedRoot.id && isSubject(child));
          if (governorSubjects.length > 0) {
            governorWithSubjectCount += 1;
            if (quotedRootClauseLike) clauseLikeGovernorWithSubjectCount += 1;
            if (governorSubjects.some((child) => relationBase(child.relation) === "nsubj")) {
              governorWithNominalSubjectCount += 1;
            }
            if (governorSubjects.some((child) => relationBase(child.relation) === "csubj")) {
              governorWithClausalSubjectCount += 1;
            }
          } else {
            governorWithoutSubjectCount += 1;
          }

          const otherChildren = governorChildren.filter((child) => child.id !== quotedRoot.id);
          governorHasObject = otherChildren.some((child) => relationBase(child.relation) === "obj");
          governorHasOtherCcomp = otherChildren.some((child) => relationBase(child.relation) === "ccomp");
          governorHasXcomp = otherChildren.some((child) => relationBase(child.relation) === "xcomp");
          governorHasOtherParataxis = otherChildren.some((child) =>
            relationBase(child.relation) === "parataxis");
          if (governorHasObject) governorWithObjectCount += 1;
          if (governorHasOtherCcomp) governorWithOtherCcompCount += 1;
          if (governorHasXcomp) governorWithXcompCount += 1;
          if (governorHasOtherParataxis) governorWithOtherParataxisCount += 1;
          if (quotedRootClauseLike) {
            if (governorHasObject) clauseLikeGovernorWithObjectCount += 1;
            if (governorHasOtherCcomp) clauseLikeGovernorWithOtherCcompCount += 1;
            if (governorHasXcomp) clauseLikeGovernorWithXcompCount += 1;
            if (governorHasOtherParataxis) clauseLikeGovernorWithOtherParataxisCount += 1;
          }

          const quotedRelationBase = relationBase(quotedRoot.relation);
          const directQuoteCandidate = quotedRootClauseLike
            && ["ccomp", "xcomp", "parataxis", "obj"].includes(quotedRelationBase);
          if (directQuoteCandidate) {
            directQuoteCandidateCount += 1;
            increment(directQuoteRelationCounts, quotedRoot.relation);
            increment(directQuoteGovernorUposCounts, governor.upos);
            if (governor.head === 0 || governor.relation === "root") {
              directQuoteGovernorRootCount += 1;
            } else {
              directQuoteGovernorNonRootCount += 1;
            }
            if (governorSubjects.length > 0) {
              directQuoteGovernorWithSubjectCount += 1;
              if (governorSubjects.some((child) => relationBase(child.relation) === "nsubj")) {
                directQuoteGovernorWithNominalSubjectCount += 1;
              }
              if (governorSubjects.some((child) => relationBase(child.relation) === "csubj")) {
                directQuoteGovernorWithClausalSubjectCount += 1;
              }
            }
            if (governorHasObject) directQuoteGovernorWithObjectCount += 1;
            if (governorHasOtherCcomp) directQuoteGovernorWithOtherCcompCount += 1;
            if (governorHasXcomp) directQuoteGovernorWithXcompCount += 1;
            if (governorHasOtherParataxis) directQuoteGovernorWithOtherParataxisCount += 1;
          }

          quoteBeforeGovernor = span.closeId < governor.id;
          if (quoteBeforeGovernor) {
            quoteBeforeGovernorCount += 1;
            if (quotedRootClauseLike) clauseLikeQuoteBeforeGovernorCount += 1;
            if (directQuoteCandidate) directQuoteBeforeGovernorCount += 1;
          } else {
            quoteAfterGovernorCount += 1;
            if (quotedRootClauseLike) clauseLikeQuoteAfterGovernorCount += 1;
            if (directQuoteCandidate) directQuoteAfterGovernorCount += 1;
          }
        }

        occurrences.push({
          sourceIndex,
          sentenceIndex,
          sentence: sentence.map((token) => token.form).join(""),
          openId: span.openId,
          closeId: span.closeId,
          boundaryRootCount: boundaryRoots.length,
          quotedRootId: quotedRoot?.id ?? null,
          quotedRootForm: quotedRoot?.form ?? null,
          quotedRootUpos: quotedRoot?.upos ?? null,
          quotedRootRelation: quotedRoot?.relation ?? null,
          quotedRootSubjectCount: quotedSubjects.length,
          quotedRootHasCopula,
          quotedRootClauseLike,
          governorId: governor?.id ?? null,
          governorForm: governor?.form ?? null,
          governorUpos: governor?.upos ?? null,
          governorRelation: governor?.relation ?? null,
          governorIsRoot: governor === null
            ? null
            : governor.head === 0 || governor.relation === "root",
          governorSubjectCount: governorSubjects.length,
          governorHasObject,
          governorHasOtherCcomp,
          governorHasXcomp,
          governorHasOtherParataxis,
          quoteBeforeGovernor,
        });
      }
    }
  }

  return {
    contract: QUOTED_CONTENT_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    quotePunctuationFormCounts: sortedRecord(quotePunctuationFormCounts),
    cornerQuoteSpanCount,
    spanWithNoBoundaryRootCount,
    spanWithSingleBoundaryRootCount,
    spanWithMultipleBoundaryRootsCount,
    standaloneQuotedRootCount,
    externallyAttachedQuotedRootCount,
    quotedRootRelationCounts: sortedRecord(quotedRootRelationCounts),
    quotedRootUposCounts: sortedRecord(quotedRootUposCounts),
    quotedRootIdentityCounts,
    governorUposCounts: sortedRecord(governorUposCounts),
    governorRelationCounts: sortedRecord(governorRelationCounts),
    governorIdentityCounts,
    governorRootCount,
    governorNonRootCount,
    governorWithSubjectCount,
    governorWithoutSubjectCount,
    governorWithNominalSubjectCount,
    governorWithClausalSubjectCount,
    governorWithObjectCount,
    governorWithOtherCcompCount,
    governorWithXcompCount,
    governorWithOtherParataxisCount,
    quotedRootWithSubjectCount,
    quotedRootWithoutSubjectCount,
    clauseLikeQuotedRootCount,
    clauseLikeExternallyAttachedCount,
    clauseLikeRelationCounts: sortedRecord(clauseLikeRelationCounts),
    clauseLikeUposCounts: sortedRecord(clauseLikeUposCounts),
    clauseLikeGovernorUposCounts: sortedRecord(clauseLikeGovernorUposCounts),
    clauseLikeGovernorWithSubjectCount,
    clauseLikeGovernorWithObjectCount,
    clauseLikeGovernorWithOtherCcompCount,
    clauseLikeGovernorWithXcompCount,
    clauseLikeGovernorWithOtherParataxisCount,
    clauseLikeQuoteBeforeGovernorCount,
    clauseLikeQuoteAfterGovernorCount,
    directQuoteCandidateCount,
    directQuoteRelationCounts: sortedRecord(directQuoteRelationCounts),
    directQuoteGovernorUposCounts: sortedRecord(directQuoteGovernorUposCounts),
    directQuoteGovernorRootCount,
    directQuoteGovernorNonRootCount,
    directQuoteGovernorWithSubjectCount,
    directQuoteGovernorWithNominalSubjectCount,
    directQuoteGovernorWithClausalSubjectCount,
    directQuoteGovernorWithObjectCount,
    directQuoteGovernorWithOtherCcompCount,
    directQuoteGovernorWithXcompCount,
    directQuoteGovernorWithOtherParataxisCount,
    directQuoteBeforeGovernorCount,
    directQuoteAfterGovernorCount,
    quoteBeforeGovernorCount,
    quoteAfterGovernorCount,
    quotedRootIdentityDigest: digestMap(quotedRootIdentityCounts),
    governorIdentityDigest: digestMap(governorIdentityCounts),
    occurrences,
  };
}

export async function auditPinnedQuotedContentSourceEvidence():
Promise<QuotedContentSourceEvidenceSummary> {
  return summarizeQuotedContentSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
