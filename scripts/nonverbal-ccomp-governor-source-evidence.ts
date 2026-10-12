import { createHash } from "node:crypto";
import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const NONVERBAL_CCOMP_GOVERNOR_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-nonverbal-ccomp-governor-inventory-v1" as const;

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

function isSubjectRelation(token: UdOccurrenceToken): boolean {
  const base = relationBase(token.relation);
  return base === "nsubj" || base === "csubj";
}

export interface NonverbalCcompGovernorOccurrence {
  readonly sourceIndex: number;
  readonly sentenceIndex: number;
  readonly sentence: string;
  readonly governorId: number;
  readonly governorForm: string;
  readonly governorUpos: string;
  readonly governorRelation: string;
  readonly governorIsRoot: boolean;
  readonly governorHeadForm: string | null;
  readonly ccompId: number;
  readonly ccompForm: string;
  readonly ccompUpos: string;
  readonly ccompBeforeGovernor: boolean;
  readonly subjectRelations: readonly string[];
  readonly childRelations: readonly string[];
  readonly ccompMarkerForms: readonly string[];
  readonly ccompCaseForms: readonly string[];
  readonly hasCopulaChild: boolean;
  readonly hasObjectChild: boolean;
  readonly hasAdditionalCcompChild: boolean;
  readonly hasXcompChild: boolean;
}

export interface NonverbalCcompGovernorSourceEvidenceSummary {
  readonly contract: typeof NONVERBAL_CCOMP_GOVERNOR_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly totalCcompTokenCount: number;
  readonly nonverbalGovernorTokenCount: number;
  readonly governorUposCounts: Readonly<Record<string, number>>;
  readonly governorIdentityCounts: ReadonlyMap<string, number>;
  readonly governorIdentityDigest: string;
  readonly governorRelationCounts: Readonly<Record<string, number>>;
  readonly governorUposRelationCounts: Readonly<Record<string, number>>;
  readonly governorRootUposCounts: Readonly<Record<string, number>>;
  readonly governorNonRootUposCounts: Readonly<Record<string, number>>;
  readonly governorWithSubjectUposCounts: Readonly<Record<string, number>>;
  readonly governorWithoutSubjectUposCounts: Readonly<Record<string, number>>;
  readonly governorWithCopulaUposCounts: Readonly<Record<string, number>>;
  readonly governorWithObjectUposCounts: Readonly<Record<string, number>>;
  readonly governorWithAdditionalCcompUposCounts: Readonly<Record<string, number>>;
  readonly governorWithXcompUposCounts: Readonly<Record<string, number>>;
  readonly ccompBeforeGovernorUposCounts: Readonly<Record<string, number>>;
  readonly ccompAfterGovernorUposCounts: Readonly<Record<string, number>>;
  readonly ccompHeadUposByGovernorUposCounts: Readonly<Record<string, number>>;
  readonly ccompWithMarkerUposCounts: Readonly<Record<string, number>>;
  readonly ccompWithoutMarkerUposCounts: Readonly<Record<string, number>>;
  readonly ccompMarkerFormByGovernorUposCounts: Readonly<Record<string, number>>;
  readonly ccompCaseFormByGovernorUposCounts: Readonly<Record<string, number>>;
  readonly ccompCaseFormByGovernorIdentityCounts: Readonly<Record<string, number>>;
  readonly occurrences: readonly NonverbalCcompGovernorOccurrence[];
}

export function summarizeNonverbalCcompGovernorSourceEvidence(
  sources: readonly string[],
): NonverbalCcompGovernorSourceEvidenceSummary {
  const governorUposCounts = new Map<string, number>();
  const governorIdentityCounts = new Map<string, number>();
  const governorRelationCounts = new Map<string, number>();
  const governorUposRelationCounts = new Map<string, number>();
  const governorRootUposCounts = new Map<string, number>();
  const governorNonRootUposCounts = new Map<string, number>();
  const governorWithSubjectUposCounts = new Map<string, number>();
  const governorWithoutSubjectUposCounts = new Map<string, number>();
  const governorWithCopulaUposCounts = new Map<string, number>();
  const governorWithObjectUposCounts = new Map<string, number>();
  const governorWithAdditionalCcompUposCounts = new Map<string, number>();
  const governorWithXcompUposCounts = new Map<string, number>();
  const ccompBeforeGovernorUposCounts = new Map<string, number>();
  const ccompAfterGovernorUposCounts = new Map<string, number>();
  const ccompHeadUposByGovernorUposCounts = new Map<string, number>();
  const ccompWithMarkerUposCounts = new Map<string, number>();
  const ccompWithoutMarkerUposCounts = new Map<string, number>();
  const ccompMarkerFormByGovernorUposCounts = new Map<string, number>();
  const ccompCaseFormByGovernorUposCounts = new Map<string, number>();
  const ccompCaseFormByGovernorIdentityCounts = new Map<string, number>();
  const occurrences: NonverbalCcompGovernorOccurrence[] = [];

  let sentenceCount = 0;
  let tokenCount = 0;
  let totalCcompTokenCount = 0;
  let nonverbalGovernorTokenCount = 0;

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    const sentences = parseUdOccurrenceSentences(source);
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      const sentence = sentences[sentenceIndex]!;
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = new Map(sentence.map((token) => [token.id, token]));
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const ccomp of sentence) {
        if (relationBase(ccomp.relation) !== "ccomp") continue;
        totalCcompTokenCount += 1;
        if (ccomp.head === 0) continue;
        const governor = byId.get(ccomp.head);
        if (governor === undefined || governor.upos === "VERB") continue;

        nonverbalGovernorTokenCount += 1;
        increment(governorUposCounts, governor.upos);
        increment(governorIdentityCounts, lexemeUposKey(governor.form, governor.upos));
        increment(governorRelationCounts, governor.relation);
        increment(governorUposRelationCounts, `${governor.upos}\u0000${governor.relation}`);
        increment(
          ccompHeadUposByGovernorUposCounts,
          `${governor.upos}\u0000${ccomp.upos}`,
        );

        const isRoot = governor.head === 0 || governor.relation === "root";
        increment(isRoot ? governorRootUposCounts : governorNonRootUposCounts, governor.upos);

        const children = childrenByHead.get(governor.id) ?? [];
        const ccompChildren = childrenByHead.get(ccomp.id) ?? [];
        const ccompMarkers = ccompChildren.filter((child) => relationBase(child.relation) === "mark");
        const ccompCases = ccompChildren.filter((child) => relationBase(child.relation) === "case");
        increment(
          ccompMarkers.length > 0 ? ccompWithMarkerUposCounts : ccompWithoutMarkerUposCounts,
          governor.upos,
        );
        for (const marker of ccompMarkers) {
          increment(ccompMarkerFormByGovernorUposCounts, `${governor.upos}\u0000${marker.form}`);
        }
        for (const caseMarker of ccompCases) {
          increment(ccompCaseFormByGovernorUposCounts, `${governor.upos}\u0000${caseMarker.form}`);
          increment(
            ccompCaseFormByGovernorIdentityCounts,
            `${governor.form}\u0000${governor.upos}\u0000${caseMarker.form}`,
          );
        }
        const subjects = children.filter((child) => child.id !== ccomp.id && isSubjectRelation(child));
        increment(
          subjects.length > 0 ? governorWithSubjectUposCounts : governorWithoutSubjectUposCounts,
          governor.upos,
        );
        if (children.some((child) => relationBase(child.relation) === "cop")) {
          increment(governorWithCopulaUposCounts, governor.upos);
        }
        if (children.some((child) => child.id !== ccomp.id && relationBase(child.relation) === "obj")) {
          increment(governorWithObjectUposCounts, governor.upos);
        }
        if (children.some((child) => child.id !== ccomp.id && relationBase(child.relation) === "ccomp")) {
          increment(governorWithAdditionalCcompUposCounts, governor.upos);
        }
        if (children.some((child) => relationBase(child.relation) === "xcomp")) {
          increment(governorWithXcompUposCounts, governor.upos);
        }

        if (ccomp.id < governor.id) increment(ccompBeforeGovernorUposCounts, governor.upos);
        else increment(ccompAfterGovernorUposCounts, governor.upos);

        const parent = governor.head === 0 ? null : byId.get(governor.head) ?? null;
        occurrences.push({
          sourceIndex,
          sentenceIndex,
          sentence: sentence.map((token) => token.form).join(""),
          governorId: governor.id,
          governorForm: governor.form,
          governorUpos: governor.upos,
          governorRelation: governor.relation,
          governorIsRoot: isRoot,
          governorHeadForm: parent?.form ?? null,
          ccompId: ccomp.id,
          ccompForm: ccomp.form,
          ccompUpos: ccomp.upos,
          ccompBeforeGovernor: ccomp.id < governor.id,
          subjectRelations: subjects.map((child) => child.relation).sort(),
          childRelations: children.map((child) => child.relation).sort(),
          ccompMarkerForms: ccompMarkers.map((child) => child.form).sort(),
          ccompCaseForms: ccompCases.map((child) => child.form).sort(),
          hasCopulaChild: children.some((child) => relationBase(child.relation) === "cop"),
          hasObjectChild: children.some(
            (child) => child.id !== ccomp.id && relationBase(child.relation) === "obj",
          ),
          hasAdditionalCcompChild: children.some(
            (child) => child.id !== ccomp.id && relationBase(child.relation) === "ccomp",
          ),
          hasXcompChild: children.some((child) => relationBase(child.relation) === "xcomp"),
        });
      }
    }
  }

  return {
    contract: NONVERBAL_CCOMP_GOVERNOR_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    totalCcompTokenCount,
    nonverbalGovernorTokenCount,
    governorUposCounts: sortedRecord(governorUposCounts),
    governorIdentityCounts,
    governorIdentityDigest: digestMap(governorIdentityCounts),
    governorRelationCounts: sortedRecord(governorRelationCounts),
    governorUposRelationCounts: sortedRecord(governorUposRelationCounts),
    governorRootUposCounts: sortedRecord(governorRootUposCounts),
    governorNonRootUposCounts: sortedRecord(governorNonRootUposCounts),
    governorWithSubjectUposCounts: sortedRecord(governorWithSubjectUposCounts),
    governorWithoutSubjectUposCounts: sortedRecord(governorWithoutSubjectUposCounts),
    governorWithCopulaUposCounts: sortedRecord(governorWithCopulaUposCounts),
    governorWithObjectUposCounts: sortedRecord(governorWithObjectUposCounts),
    governorWithAdditionalCcompUposCounts: sortedRecord(governorWithAdditionalCcompUposCounts),
    governorWithXcompUposCounts: sortedRecord(governorWithXcompUposCounts),
    ccompBeforeGovernorUposCounts: sortedRecord(ccompBeforeGovernorUposCounts),
    ccompAfterGovernorUposCounts: sortedRecord(ccompAfterGovernorUposCounts),
    ccompHeadUposByGovernorUposCounts: sortedRecord(ccompHeadUposByGovernorUposCounts),
    ccompWithMarkerUposCounts: sortedRecord(ccompWithMarkerUposCounts),
    ccompWithoutMarkerUposCounts: sortedRecord(ccompWithoutMarkerUposCounts),
    ccompMarkerFormByGovernorUposCounts: sortedRecord(ccompMarkerFormByGovernorUposCounts),
    ccompCaseFormByGovernorUposCounts: sortedRecord(ccompCaseFormByGovernorUposCounts),
    ccompCaseFormByGovernorIdentityCounts: sortedRecord(ccompCaseFormByGovernorIdentityCounts),
    occurrences,
  };
}

export async function auditPinnedNonverbalCcompGovernorSourceEvidence():
Promise<NonverbalCcompGovernorSourceEvidenceSummary> {
  return summarizeNonverbalCcompGovernorSourceEvidence(
    await loadPinnedUdGsdOccurrenceSources(),
  );
}
