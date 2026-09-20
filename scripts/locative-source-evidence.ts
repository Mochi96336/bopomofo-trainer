import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const LOCATIVE_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-locative-shape-inventory-v1" as const;

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

function tokenById(tokens: readonly UdOccurrenceToken[]): ReadonlyMap<number, UdOccurrenceToken> {
  return new Map(tokens.map((token) => [token.id, token]));
}

function hasSubject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const relation = relationBase(child.relation);
    return relation === "nsubj" || relation === "csubj";
  });
}

function hasNominalComplement(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const relation = relationBase(child.relation);
    return relation === "obj" || relation === "obl";
  });
}

function hasZaiCase(
  nominalId: number,
  childrenByHead: ReadonlyMap<number, readonly UdOccurrenceToken[]>,
): boolean {
  return (childrenByHead.get(nominalId) ?? []).some(
    (child) => child.form === "在" && child.upos === "ADP" && child.relation === "case",
  );
}

export interface LocativeSourceEvidenceSummary {
  readonly contract: typeof LOCATIVE_SOURCE_EVIDENCE_CONTRACT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly zaiTokenCount: number;
  readonly zaiUposCounts: Readonly<Record<string, number>>;
  readonly zaiRelationCounts: Readonly<Record<string, number>>;
  readonly zaiVerbTokenCount: number;
  readonly zaiVerbRootTokenCount: number;
  readonly zaiVerbRootWithSubjectTokenCount: number;
  readonly zaiVerbRootWithObjectTokenCount: number;
  readonly zaiVerbRootWithSubjectAndObjectTokenCount: number;
  readonly zaiVerbWithSubjectTokenCount: number;
  readonly zaiVerbWithNominalComplementTokenCount: number;
  readonly zaiVerbWithCopChildTokenCount: number;
  readonly zaiVerbChildRelationCounts: Readonly<Record<string, number>>;
  readonly zaiAdpCaseTokenCount: number;
  readonly zaiCaseHeadRelationCounts: Readonly<Record<string, number>>;
  readonly zaiCaseObliqueHeadTokenCount: number;
  readonly zaiCaseRootHeadTokenCount: number;
  readonly zaiCaseHeadWithCopTokenCount: number;
  readonly zaiCaseHeadWithSubjectTokenCount: number;
  readonly zaiCaseHeadWithCopAndSubjectTokenCount: number;
  readonly zaiCaseHeadUposCounts: Readonly<Record<string, number>>;
  readonly predicateWithZaiObliqueTokenCount: number;
  readonly predicateWithZaiObliqueVerbTokenCount: number;
  readonly predicateWithZaiObliqueUposCounts: Readonly<Record<string, number>>;
  readonly predicateWithZaiObliqueFormCounts: Readonly<Record<string, number>>;
  readonly obliqueCaseMarkerTokenCount: number;
  readonly obliqueCaseMarkerFormCounts: Readonly<Record<string, number>>;
  readonly youVerbTokenCount: number;
  readonly youVerbRootTokenCount: number;
  readonly youVerbWithSubjectTokenCount: number;
  readonly youVerbWithObjectTokenCount: number;
  readonly youVerbWithZaiObliqueTokenCount: number;
}

export function summarizeLocativeSourceEvidence(
  sources: readonly string[],
): LocativeSourceEvidenceSummary {
  const zaiUposCounts = new Map<string, number>();
  const zaiRelationCounts = new Map<string, number>();
  const zaiVerbChildRelationCounts = new Map<string, number>();
  const zaiCaseHeadRelationCounts = new Map<string, number>();
  const zaiCaseHeadUposCounts = new Map<string, number>();
  const predicateWithZaiObliqueUposCounts = new Map<string, number>();
  const predicateWithZaiObliqueFormCounts = new Map<string, number>();
  const obliqueCaseMarkerFormCounts = new Map<string, number>();

  let sentenceCount = 0;
  let tokenCount = 0;
  let zaiTokenCount = 0;
  let zaiVerbTokenCount = 0;
  let zaiVerbRootTokenCount = 0;
  let zaiVerbRootWithSubjectTokenCount = 0;
  let zaiVerbRootWithObjectTokenCount = 0;
  let zaiVerbRootWithSubjectAndObjectTokenCount = 0;
  let zaiVerbWithSubjectTokenCount = 0;
  let zaiVerbWithNominalComplementTokenCount = 0;
  let zaiVerbWithCopChildTokenCount = 0;
  let zaiAdpCaseTokenCount = 0;
  let zaiCaseObliqueHeadTokenCount = 0;
  let zaiCaseRootHeadTokenCount = 0;
  let zaiCaseHeadWithCopTokenCount = 0;
  let zaiCaseHeadWithSubjectTokenCount = 0;
  let zaiCaseHeadWithCopAndSubjectTokenCount = 0;
  let predicateWithZaiObliqueTokenCount = 0;
  let predicateWithZaiObliqueVerbTokenCount = 0;
  let obliqueCaseMarkerTokenCount = 0;
  let youVerbTokenCount = 0;
  let youVerbRootTokenCount = 0;
  let youVerbWithSubjectTokenCount = 0;
  let youVerbWithObjectTokenCount = 0;
  let youVerbWithZaiObliqueTokenCount = 0;

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      sentenceCount += 1;
      tokenCount += sentence.length;
      const byId = tokenById(sentence);
      const childrenByHead = indexUdOccurrenceChildren(sentence);

      for (const token of sentence) {
        const children = childrenByHead.get(token.id) ?? [];

        if (token.upos === "ADP" && token.relation === "case") {
          const nominalHead = byId.get(token.head);
          if (nominalHead !== undefined && relationBase(nominalHead.relation) === "obl") {
            obliqueCaseMarkerTokenCount += 1;
            increment(obliqueCaseMarkerFormCounts, token.form);
          }
        }

        if (token.form === "有" && token.upos === "VERB") {
          youVerbTokenCount += 1;
          if (token.head === 0 || token.relation === "root") youVerbRootTokenCount += 1;
          if (hasSubject(children)) youVerbWithSubjectTokenCount += 1;
          if (children.some((child) => relationBase(child.relation) === "obj")) {
            youVerbWithObjectTokenCount += 1;
          }
          if (children.some(
            (child) => relationBase(child.relation) === "obl" && hasZaiCase(child.id, childrenByHead),
          )) {
            youVerbWithZaiObliqueTokenCount += 1;
          }
        }

        if (token.form !== "在") continue;
        zaiTokenCount += 1;
        increment(zaiUposCounts, token.upos);
        increment(zaiRelationCounts, token.relation);

        if (token.upos === "VERB") {
          zaiVerbTokenCount += 1;
          const root = token.head === 0 || token.relation === "root";
          const subject = hasSubject(children);
          const object = children.some((child) => relationBase(child.relation) === "obj");
          if (root) zaiVerbRootTokenCount += 1;
          if (root && subject) zaiVerbRootWithSubjectTokenCount += 1;
          if (root && object) zaiVerbRootWithObjectTokenCount += 1;
          if (root && subject && object) zaiVerbRootWithSubjectAndObjectTokenCount += 1;
          if (subject) zaiVerbWithSubjectTokenCount += 1;
          if (hasNominalComplement(children)) zaiVerbWithNominalComplementTokenCount += 1;
          if (children.some((child) => child.relation === "cop")) {
            zaiVerbWithCopChildTokenCount += 1;
          }
          for (const child of children) increment(zaiVerbChildRelationCounts, child.relation);
        }

        if (token.upos !== "ADP" || token.relation !== "case") continue;
        zaiAdpCaseTokenCount += 1;
        const nominalHead = byId.get(token.head);
        if (nominalHead === undefined) continue;

        increment(zaiCaseHeadRelationCounts, nominalHead.relation);
        increment(zaiCaseHeadUposCounts, nominalHead.upos);
        const headChildren = childrenByHead.get(nominalHead.id) ?? [];
        const headHasCop = headChildren.some((child) => child.relation === "cop");
        const headHasSubject = hasSubject(headChildren);

        if (relationBase(nominalHead.relation) === "obl") {
          zaiCaseObliqueHeadTokenCount += 1;
          const predicate = byId.get(nominalHead.head);
          if (predicate !== undefined) {
            predicateWithZaiObliqueTokenCount += 1;
            if (predicate.upos === "VERB") predicateWithZaiObliqueVerbTokenCount += 1;
            increment(predicateWithZaiObliqueUposCounts, predicate.upos);
            increment(predicateWithZaiObliqueFormCounts, predicate.form);
          }
        }
        if (nominalHead.head === 0 || nominalHead.relation === "root") {
          zaiCaseRootHeadTokenCount += 1;
        }
        if (headHasCop) zaiCaseHeadWithCopTokenCount += 1;
        if (headHasSubject) zaiCaseHeadWithSubjectTokenCount += 1;
        if (headHasCop && headHasSubject) zaiCaseHeadWithCopAndSubjectTokenCount += 1;
      }
    }
  }

  return {
    contract: LOCATIVE_SOURCE_EVIDENCE_CONTRACT,
    sentenceCount,
    tokenCount,
    zaiTokenCount,
    zaiUposCounts: sortedRecord(zaiUposCounts),
    zaiRelationCounts: sortedRecord(zaiRelationCounts),
    zaiVerbTokenCount,
    zaiVerbRootTokenCount,
    zaiVerbRootWithSubjectTokenCount,
    zaiVerbRootWithObjectTokenCount,
    zaiVerbRootWithSubjectAndObjectTokenCount,
    zaiVerbWithSubjectTokenCount,
    zaiVerbWithNominalComplementTokenCount,
    zaiVerbWithCopChildTokenCount,
    zaiVerbChildRelationCounts: sortedRecord(zaiVerbChildRelationCounts),
    zaiAdpCaseTokenCount,
    zaiCaseHeadRelationCounts: sortedRecord(zaiCaseHeadRelationCounts),
    zaiCaseObliqueHeadTokenCount,
    zaiCaseRootHeadTokenCount,
    zaiCaseHeadWithCopTokenCount,
    zaiCaseHeadWithSubjectTokenCount,
    zaiCaseHeadWithCopAndSubjectTokenCount,
    zaiCaseHeadUposCounts: sortedRecord(zaiCaseHeadUposCounts),
    predicateWithZaiObliqueTokenCount,
    predicateWithZaiObliqueVerbTokenCount,
    predicateWithZaiObliqueUposCounts: sortedRecord(predicateWithZaiObliqueUposCounts),
    predicateWithZaiObliqueFormCounts: sortedRecord(predicateWithZaiObliqueFormCounts),
    obliqueCaseMarkerTokenCount,
    obliqueCaseMarkerFormCounts: sortedRecord(obliqueCaseMarkerFormCounts),
    youVerbTokenCount,
    youVerbRootTokenCount,
    youVerbWithSubjectTokenCount,
    youVerbWithObjectTokenCount,
    youVerbWithZaiObliqueTokenCount,
  };
}

export async function auditPinnedLocativeSourceEvidence(): Promise<LocativeSourceEvidenceSummary> {
  return summarizeLocativeSourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
