import { createHash } from "node:crypto";
import {
  auditPinnedQuotedContentSourceEvidence,
  type QuotedContentOccurrence,
} from "./quoted-content-source-evidence.js";

export const DIRECT_QUOTE_ATTACHMENT_EVIDENCE_CONTRACT =
  "pinned-gsd-direct-quote-attachment-identity-v1" as const;

const DIRECT_ATTACHMENT_RELATIONS = new Set(["ccomp", "xcomp", "parataxis", "obj"]);

function relationBase(relation: string | null): string | null {
  return relation === null ? null : relation.split(":", 1)[0] ?? relation;
}

function increment(target: Map<string, number>, key: string): void {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function sortedRecord(values: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...values].sort(([a], [b]) => a.localeCompare(b, "zh-Hant")));
}

function identity(form: string, upos: string): string {
  return `${form}\u0000${upos}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function isDirectQuoteCandidate(
  occurrence: QuotedContentOccurrence,
): occurrence is QuotedContentOccurrence & {
  readonly quotedRootForm: string;
  readonly quotedRootUpos: string;
  readonly quotedRootRelation: string;
  readonly governorForm: string;
  readonly governorUpos: string;
  readonly governorRelation: string;
  readonly governorIsRoot: boolean;
  readonly quoteBeforeGovernor: boolean;
} {
  const relation = relationBase(occurrence.quotedRootRelation);
  return occurrence.quotedRootClauseLike
    && relation !== null
    && DIRECT_ATTACHMENT_RELATIONS.has(relation)
    && occurrence.quotedRootForm !== null
    && occurrence.quotedRootUpos !== null
    && occurrence.governorForm !== null
    && occurrence.governorUpos !== null
    && occurrence.governorRelation !== null
    && occurrence.governorIsRoot !== null
    && occurrence.quoteBeforeGovernor !== null;
}

export interface DirectQuoteAttachmentOccurrence {
  readonly sourceIndex: number;
  readonly sentenceIndex: number;
  readonly sentence: string;
  readonly attachmentRelation: "ccomp" | "xcomp" | "parataxis" | "obj";
  readonly quotedRootForm: string;
  readonly quotedRootUpos: string;
  readonly quotedRootSubjectCount: number;
  readonly governorForm: string;
  readonly governorUpos: string;
  readonly governorRelation: string;
  readonly governorIsRoot: boolean;
  readonly governorSubjectCount: number;
  readonly governorHasObject: boolean;
  readonly governorHasOtherCcomp: boolean;
  readonly governorHasXcomp: boolean;
  readonly governorHasOtherParataxis: boolean;
  readonly quoteBeforeGovernor: boolean;
}

export interface CrossRelationGovernorIdentity {
  readonly identity: string;
  readonly form: string;
  readonly upos: string;
  readonly relations: readonly string[];
  readonly occurrenceCount: number;
}

export interface DirectQuoteAttachmentEvidenceSummary {
  readonly contract: typeof DIRECT_QUOTE_ATTACHMENT_EVIDENCE_CONTRACT;
  readonly candidateCount: number;
  readonly relationCounts: Readonly<Record<string, number>>;
  readonly relationByGovernorUposCounts: Readonly<Record<string, number>>;
  readonly relationByGovernorRootStatusCounts: Readonly<Record<string, number>>;
  readonly relationByGovernorSubjectPresenceCounts: Readonly<Record<string, number>>;
  readonly relationByQuoteOrderCounts: Readonly<Record<string, number>>;
  readonly relationByGovernorObjectPresenceCounts: Readonly<Record<string, number>>;
  readonly relationByOtherCcompPresenceCounts: Readonly<Record<string, number>>;
  readonly relationByXcompPresenceCounts: Readonly<Record<string, number>>;
  readonly relationByOtherParataxisPresenceCounts: Readonly<Record<string, number>>;
  readonly governorIdentityCounts: Readonly<Record<string, number>>;
  readonly governorIdentityCount: number;
  readonly governorIdentityByRelationCounts: Readonly<Record<string, number>>;
  readonly uniqueGovernorIdentityCountByRelation: Readonly<Record<string, number>>;
  readonly crossRelationGovernorIdentityCount: number;
  readonly crossRelationGovernorIdentities: readonly CrossRelationGovernorIdentity[];
  readonly relationPairSharedGovernorIdentityCounts: Readonly<Record<string, number>>;
  readonly occurrenceDigest: string;
  readonly governorIdentityRelationDigest: string;
  readonly occurrences: readonly DirectQuoteAttachmentOccurrence[];
}

export function summarizeDirectQuoteAttachmentEvidence(
  quotedOccurrences: readonly QuotedContentOccurrence[],
): DirectQuoteAttachmentEvidenceSummary {
  const relationCounts = new Map<string, number>();
  const relationByGovernorUposCounts = new Map<string, number>();
  const relationByGovernorRootStatusCounts = new Map<string, number>();
  const relationByGovernorSubjectPresenceCounts = new Map<string, number>();
  const relationByQuoteOrderCounts = new Map<string, number>();
  const relationByGovernorObjectPresenceCounts = new Map<string, number>();
  const relationByOtherCcompPresenceCounts = new Map<string, number>();
  const relationByXcompPresenceCounts = new Map<string, number>();
  const relationByOtherParataxisPresenceCounts = new Map<string, number>();
  const governorIdentityCounts = new Map<string, number>();
  const governorIdentityByRelationCounts = new Map<string, number>();
  const relationsByGovernorIdentity = new Map<string, Set<string>>();
  const uniqueIdentitiesByRelation = new Map<string, Set<string>>();
  const occurrences: DirectQuoteAttachmentOccurrence[] = [];

  for (const occurrence of quotedOccurrences) {
    if (!isDirectQuoteCandidate(occurrence)) continue;
    const attachmentRelation = relationBase(occurrence.quotedRootRelation)! as
      "ccomp" | "xcomp" | "parataxis" | "obj";
    const governorIdentity = identity(occurrence.governorForm, occurrence.governorUpos);

    increment(relationCounts, attachmentRelation);
    increment(relationByGovernorUposCounts, `${attachmentRelation}\u0000${occurrence.governorUpos}`);
    increment(
      relationByGovernorRootStatusCounts,
      `${attachmentRelation}\u0000${occurrence.governorIsRoot ? "root" : "nonroot"}`,
    );
    increment(
      relationByGovernorSubjectPresenceCounts,
      `${attachmentRelation}\u0000${occurrence.governorSubjectCount > 0 ? "subject" : "no-subject"}`,
    );
    increment(
      relationByQuoteOrderCounts,
      `${attachmentRelation}\u0000${occurrence.quoteBeforeGovernor ? "quote-before" : "quote-after"}`,
    );
    increment(
      relationByGovernorObjectPresenceCounts,
      `${attachmentRelation}\u0000${occurrence.governorHasObject ? "object" : "no-object"}`,
    );
    increment(
      relationByOtherCcompPresenceCounts,
      `${attachmentRelation}\u0000${occurrence.governorHasOtherCcomp ? "other-ccomp" : "no-other-ccomp"}`,
    );
    increment(
      relationByXcompPresenceCounts,
      `${attachmentRelation}\u0000${occurrence.governorHasXcomp ? "xcomp" : "no-xcomp"}`,
    );
    increment(
      relationByOtherParataxisPresenceCounts,
      `${attachmentRelation}\u0000${occurrence.governorHasOtherParataxis ? "other-parataxis" : "no-other-parataxis"}`,
    );
    increment(governorIdentityCounts, governorIdentity);
    increment(governorIdentityByRelationCounts, `${attachmentRelation}\u0000${governorIdentity}`);

    const relations = relationsByGovernorIdentity.get(governorIdentity) ?? new Set<string>();
    relations.add(attachmentRelation);
    relationsByGovernorIdentity.set(governorIdentity, relations);

    const identities = uniqueIdentitiesByRelation.get(attachmentRelation) ?? new Set<string>();
    identities.add(governorIdentity);
    uniqueIdentitiesByRelation.set(attachmentRelation, identities);

    occurrences.push({
      sourceIndex: occurrence.sourceIndex,
      sentenceIndex: occurrence.sentenceIndex,
      sentence: occurrence.sentence,
      attachmentRelation,
      quotedRootForm: occurrence.quotedRootForm,
      quotedRootUpos: occurrence.quotedRootUpos,
      quotedRootSubjectCount: occurrence.quotedRootSubjectCount,
      governorForm: occurrence.governorForm,
      governorUpos: occurrence.governorUpos,
      governorRelation: occurrence.governorRelation,
      governorIsRoot: occurrence.governorIsRoot,
      governorSubjectCount: occurrence.governorSubjectCount,
      governorHasObject: occurrence.governorHasObject,
      governorHasOtherCcomp: occurrence.governorHasOtherCcomp,
      governorHasXcomp: occurrence.governorHasXcomp,
      governorHasOtherParataxis: occurrence.governorHasOtherParataxis,
      quoteBeforeGovernor: occurrence.quoteBeforeGovernor,
    });
  }

  occurrences.sort((left, right) =>
    left.attachmentRelation.localeCompare(right.attachmentRelation)
    || left.governorForm.localeCompare(right.governorForm, "zh-Hant")
    || left.sourceIndex - right.sourceIndex
    || left.sentenceIndex - right.sentenceIndex
    || left.sentence.localeCompare(right.sentence, "zh-Hant"));

  const crossRelationGovernorIdentities = [...relationsByGovernorIdentity.entries()]
    .filter(([, relations]) => relations.size > 1)
    .map(([key, relations]) => {
      const separator = key.lastIndexOf("\u0000");
      return {
        identity: key,
        form: key.slice(0, separator),
        upos: key.slice(separator + 1),
        relations: [...relations].sort(),
        occurrenceCount: governorIdentityCounts.get(key) ?? 0,
      };
    })
    .sort((left, right) =>
      right.relations.length - left.relations.length
      || right.occurrenceCount - left.occurrenceCount
      || left.form.localeCompare(right.form, "zh-Hant"));

  const relationPairSharedGovernorIdentityCounts = new Map<string, number>();
  const relationNames = [...uniqueIdentitiesByRelation.keys()].sort();
  for (let leftIndex = 0; leftIndex < relationNames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < relationNames.length; rightIndex += 1) {
      const left = relationNames[leftIndex]!;
      const right = relationNames[rightIndex]!;
      const leftSet = uniqueIdentitiesByRelation.get(left)!;
      const rightSet = uniqueIdentitiesByRelation.get(right)!;
      let shared = 0;
      for (const item of leftSet) if (rightSet.has(item)) shared += 1;
      relationPairSharedGovernorIdentityCounts.set(`${left}|${right}`, shared);
    }
  }

  const uniqueGovernorIdentityCountByRelation = new Map<string, number>();
  for (const [relation, identities] of uniqueIdentitiesByRelation) {
    uniqueGovernorIdentityCountByRelation.set(relation, identities.size);
  }

  const occurrenceDigest = digest(occurrences.map((item) => ({
    sourceIndex: item.sourceIndex,
    sentenceIndex: item.sentenceIndex,
    attachmentRelation: item.attachmentRelation,
    governorForm: item.governorForm,
    governorUpos: item.governorUpos,
    quotedRootForm: item.quotedRootForm,
    quotedRootUpos: item.quotedRootUpos,
  })));
  const governorIdentityRelationDigest = digest(
    [...relationsByGovernorIdentity.entries()]
      .map(([key, relations]) => [key, [...relations].sort()])
      .sort(([left], [right]) => String(left).localeCompare(String(right), "zh-Hant")),
  );

  return {
    contract: DIRECT_QUOTE_ATTACHMENT_EVIDENCE_CONTRACT,
    candidateCount: occurrences.length,
    relationCounts: sortedRecord(relationCounts),
    relationByGovernorUposCounts: sortedRecord(relationByGovernorUposCounts),
    relationByGovernorRootStatusCounts: sortedRecord(relationByGovernorRootStatusCounts),
    relationByGovernorSubjectPresenceCounts: sortedRecord(relationByGovernorSubjectPresenceCounts),
    relationByQuoteOrderCounts: sortedRecord(relationByQuoteOrderCounts),
    relationByGovernorObjectPresenceCounts: sortedRecord(relationByGovernorObjectPresenceCounts),
    relationByOtherCcompPresenceCounts: sortedRecord(relationByOtherCcompPresenceCounts),
    relationByXcompPresenceCounts: sortedRecord(relationByXcompPresenceCounts),
    relationByOtherParataxisPresenceCounts: sortedRecord(relationByOtherParataxisPresenceCounts),
    governorIdentityCounts: sortedRecord(governorIdentityCounts),
    governorIdentityCount: governorIdentityCounts.size,
    governorIdentityByRelationCounts: sortedRecord(governorIdentityByRelationCounts),
    uniqueGovernorIdentityCountByRelation: sortedRecord(uniqueGovernorIdentityCountByRelation),
    crossRelationGovernorIdentityCount: crossRelationGovernorIdentities.length,
    crossRelationGovernorIdentities,
    relationPairSharedGovernorIdentityCounts: sortedRecord(relationPairSharedGovernorIdentityCounts),
    occurrenceDigest,
    governorIdentityRelationDigest,
    occurrences,
  };
}

export async function auditPinnedDirectQuoteAttachmentEvidence():
Promise<DirectQuoteAttachmentEvidenceSummary> {
  const quoted = await auditPinnedQuotedContentSourceEvidence();
  return summarizeDirectQuoteAttachmentEvidence(quoted.occurrences);
}
