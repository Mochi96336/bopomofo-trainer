import { createHash } from "node:crypto";
import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const CCOMP_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-ccomp-shape-inventory-v1" as const;

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

function identityDigest(values: ReadonlyMap<string, number>): string {
  return createHash("sha256")
    .update(JSON.stringify([...values].sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))), "utf8")
    .digest("hex");
}

export interface CcompSourceEvidenceSummary {
  readonly contract: typeof CCOMP_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly ccompTokenCount: number;
  readonly ccompRelationCounts: Readonly<Record<string, number>>;
  readonly ccompHeadUposCounts: Readonly<Record<string, number>>;
  readonly ccompHeadIdentityCounts: ReadonlyMap<string, number>;
  readonly governingHeadTokenCount: number;
  readonly governingHeadUposCounts: Readonly<Record<string, number>>;
  readonly governingHeadRelationCounts: Readonly<Record<string, number>>;
  readonly governingHeadIdentityCounts: ReadonlyMap<string, number>;
  readonly ccompBeforeGovernorTokenCount: number;
  readonly ccompAfterGovernorTokenCount: number;
  readonly embeddedWithOvertSubjectTokenCount: number;
  readonly embeddedWithoutOvertSubjectTokenCount: number;
  readonly embeddedWithNominalSubjectTokenCount: number;
  readonly embeddedWithClausalSubjectTokenCount: number;
  readonly governorWithSubjectTokenCount: number;
  readonly governorWithoutSubjectTokenCount: number;
  readonly governorWithNominalSubjectTokenCount: number;
  readonly governorWithClausalSubjectTokenCount: number;
  readonly governorWithObjectTokenCount: number;
  readonly governorWithoutObjectTokenCount: number;
  readonly governorWithIndirectObjectTokenCount: number;
  readonly governorWithAdditionalCcompTokenCount: number;
  readonly governorWithXcompTokenCount: number;
  readonly governorWithCopulaTokenCount: number;
  readonly governorRootTokenCount: number;
  readonly governorNonRootTokenCount: number;
  readonly ccompWithMarkChildTokenCount: number;
  readonly ccompWithoutMarkChildTokenCount: number;
  readonly ccompChildRelationCounts: Readonly<Record<string, number>>;
  readonly governorChildRelationCounts: Readonly<Record<string, number>>;
  readonly ccompHeadIdentityDigest: string;
  readonly governingHeadIdentityDigest: string;
}

export function summarizeCcompSourceEvidence(
  sources: readonly string[],
): CcompSourceEvidenceSummary {
  const ccompRelationCounts = new Map<string, number>();
  const ccompHeadUposCounts = new Map<string, number>();
  const ccompHeadIdentityCounts = new Map<string, number>();
  const governingHeadUposCounts = new Map<string, number>();
  const governingHeadRelationCounts = new Map<string, number>();
  const governingHeadIdentityCounts = new Map<string, number>();
  const ccompChildRelationCounts = new Map<string, number>();
  const governorChildRelationCounts = new Map<string, number>();

  let sentenceCount = 0;
  let tokenCount = 0;
  let ccompTokenCount = 0;
  let governingHeadTokenCount = 0;
  let ccompBeforeGovernorTokenCount = 0;
  let ccompAfterGovernorTokenCount = 0;
  let embeddedWithOvertSubjectTokenCount = 0;
  let embeddedWithoutOvertSubjectTokenCount = 0;
  let embeddedWithNominalSubjectTokenCount = 0;
  let embeddedWithClausalSubjectTokenCount = 0;
  let governorWithSubjectTokenCount = 0;
  let governorWithoutSubjectTokenCount = 0;
  let governorWithNominalSubjectTokenCount = 0;
  let governorWithClausalSubjectTokenCount = 0;
  let governorWithObjectTokenCount = 0;
  let governorWithoutObjectTokenCount = 0;
  let governorWithIndirectObjectTokenCount = 0;
  let governorWithAdditionalCcompTokenCount = 0;
  let governorWithXcompTokenCount = 0;
  let governorWithCopulaTokenCount = 0;
  let governorRootTokenCount = 0;
  let governorNonRootTokenCount = 0;
  let ccompWithMarkChildTokenCount = 0;
  let ccompWithoutMarkChildTokenCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const ccomp of sentence) {
        if (relationBase(ccomp.relation) !== "ccomp") continue;

        ccompTokenCount += 1;
        increment(ccompRelationCounts, ccomp.relation);
        increment(ccompHeadUposCounts, ccomp.upos);
        increment(ccompHeadIdentityCounts, lexemeUposKey(ccomp.form, ccomp.upos));

        const embeddedChildren = childrenByHead.get(ccomp.id) ?? [];
        for (const child of embeddedChildren) increment(ccompChildRelationCounts, child.relation);

        const embeddedSubjects = embeddedChildren.filter(isSubjectRelation);
        if (embeddedSubjects.length > 0) {
          embeddedWithOvertSubjectTokenCount += 1;
          if (embeddedSubjects.some((child) => relationBase(child.relation) === "nsubj")) {
            embeddedWithNominalSubjectTokenCount += 1;
          }
          if (embeddedSubjects.some((child) => relationBase(child.relation) === "csubj")) {
            embeddedWithClausalSubjectTokenCount += 1;
          }
        } else {
          embeddedWithoutOvertSubjectTokenCount += 1;
        }

        if (embeddedChildren.some((child) => relationBase(child.relation) === "mark")) {
          ccompWithMarkChildTokenCount += 1;
        } else {
          ccompWithoutMarkChildTokenCount += 1;
        }

        if (ccomp.head === 0) continue;
        const governor = byId.get(ccomp.head);
        if (governor === undefined) continue;

        governingHeadTokenCount += 1;
        increment(governingHeadUposCounts, governor.upos);
        increment(governingHeadRelationCounts, governor.relation);
        increment(governingHeadIdentityCounts, lexemeUposKey(governor.form, governor.upos));

        if (ccomp.id < governor.id) ccompBeforeGovernorTokenCount += 1;
        else ccompAfterGovernorTokenCount += 1;

        const governorChildren = childrenByHead.get(governor.id) ?? [];
        for (const child of governorChildren) increment(governorChildRelationCounts, child.relation);

        const governorSubjects = governorChildren.filter((child) =>
          child.id !== ccomp.id && isSubjectRelation(child));
        if (governorSubjects.length > 0) {
          governorWithSubjectTokenCount += 1;
          if (governorSubjects.some((child) => relationBase(child.relation) === "nsubj")) {
            governorWithNominalSubjectTokenCount += 1;
          }
          if (governorSubjects.some((child) => relationBase(child.relation) === "csubj")) {
            governorWithClausalSubjectTokenCount += 1;
          }
        } else {
          governorWithoutSubjectTokenCount += 1;
        }

        const otherChildren = governorChildren.filter((child) => child.id !== ccomp.id);
        const hasObject = otherChildren.some((child) => relationBase(child.relation) === "obj");
        if (hasObject) governorWithObjectTokenCount += 1;
        else governorWithoutObjectTokenCount += 1;

        if (otherChildren.some((child) => relationBase(child.relation) === "iobj")) {
          governorWithIndirectObjectTokenCount += 1;
        }
        if (otherChildren.some((child) => relationBase(child.relation) === "ccomp")) {
          governorWithAdditionalCcompTokenCount += 1;
        }
        if (otherChildren.some((child) => relationBase(child.relation) === "xcomp")) {
          governorWithXcompTokenCount += 1;
        }
        if (otherChildren.some((child) => relationBase(child.relation) === "cop")) {
          governorWithCopulaTokenCount += 1;
        }

        if (governor.head === 0 || governor.relation === "root") {
          governorRootTokenCount += 1;
        } else {
          governorNonRootTokenCount += 1;
        }
      }
    }
  }

  return {
    contract: CCOMP_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    ccompTokenCount,
    ccompRelationCounts: sortedRecord(ccompRelationCounts),
    ccompHeadUposCounts: sortedRecord(ccompHeadUposCounts),
    ccompHeadIdentityCounts,
    governingHeadTokenCount,
    governingHeadUposCounts: sortedRecord(governingHeadUposCounts),
    governingHeadRelationCounts: sortedRecord(governingHeadRelationCounts),
    governingHeadIdentityCounts,
    ccompBeforeGovernorTokenCount,
    ccompAfterGovernorTokenCount,
    embeddedWithOvertSubjectTokenCount,
    embeddedWithoutOvertSubjectTokenCount,
    embeddedWithNominalSubjectTokenCount,
    embeddedWithClausalSubjectTokenCount,
    governorWithSubjectTokenCount,
    governorWithoutSubjectTokenCount,
    governorWithNominalSubjectTokenCount,
    governorWithClausalSubjectTokenCount,
    governorWithObjectTokenCount,
    governorWithoutObjectTokenCount,
    governorWithIndirectObjectTokenCount,
    governorWithAdditionalCcompTokenCount,
    governorWithXcompTokenCount,
    governorWithCopulaTokenCount,
    governorRootTokenCount,
    governorNonRootTokenCount,
    ccompWithMarkChildTokenCount,
    ccompWithoutMarkChildTokenCount,
    ccompChildRelationCounts: sortedRecord(ccompChildRelationCounts),
    governorChildRelationCounts: sortedRecord(governorChildRelationCounts),
    ccompHeadIdentityDigest: identityDigest(ccompHeadIdentityCounts),
    governingHeadIdentityDigest: identityDigest(governingHeadIdentityCounts),
  };
}

export async function auditPinnedCcompSourceEvidence(): Promise<CcompSourceEvidenceSummary> {
  return summarizeCcompSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
