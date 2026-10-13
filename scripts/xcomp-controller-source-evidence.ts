import { createHash } from "node:crypto";
import {
  loadPinnedUdGsdOccurrenceSources,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

export const XCOMP_CONTROLLER_SOURCE_EVIDENCE_CONTRACT =
  "pinned-gsd-xcomp-controller-evidence-v1" as const;

const SUBJECT_RELATIONS = new Set(["nsubj", "csubj"]);
const OBJECT_RELATIONS = new Set(["obj", "iobj"]);

interface EnhancedDependency {
  readonly head: string;
  readonly relation: string;
}

interface AuditToken {
  readonly id: number;
  readonly head: number;
  readonly relation: string;
  readonly deps: readonly EnhancedDependency[];
}

export type XcompControllerKind = "subject" | "object" | "other" | "unresolved";

export interface XcompControllerOccurrence {
  readonly sourceIndex: number;
  readonly sentenceIndex: number;
  readonly matrixId: number;
  readonly xcompId: number;
  readonly controllerKind: XcompControllerKind;
  readonly controllerId: number | null;
  readonly matrixHasObject: boolean;
}

export interface XcompControllerSourceEvidenceSummary {
  readonly contract: typeof XCOMP_CONTROLLER_SOURCE_EVIDENCE_CONTRACT;
  readonly sourceVersion: typeof UD_GSD_SOURCE_VERSION;
  readonly sourceCommit: typeof UD_GSD_SOURCE_COMMIT;
  readonly sentenceCount: number;
  readonly tokenCount: number;
  readonly xcompCount: number;
  readonly subjectControllerCount: number;
  readonly objectControllerCount: number;
  readonly otherControllerCount: number;
  readonly unresolvedCount: number;
  readonly basicObjectPlusXcompCount: number;
  readonly unresolvedBasicObjectPlusXcompCount: number;
  readonly enhancedXsubjEdgeCount: number;
  readonly occurrenceDigest: string;
  readonly occurrences: readonly XcompControllerOccurrence[];
}

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function parseEnhancedDependencies(value: string): readonly EnhancedDependency[] {
  if (value === "_") return [];
  return value.split("|").map((item) => {
    const separator = item.indexOf(":");
    if (separator <= 0 || separator === item.length - 1) {
      throw new Error(`invalid enhanced dependency ${item}`);
    }
    const head = item.slice(0, separator);
    const relation = item.slice(separator + 1);
    if (!/^\d+(?:\.\d+)?$/u.test(head)) {
      throw new Error(`invalid enhanced dependency head ${head}`);
    }
    return { head, relation };
  });
}

function parseSource(source: string): readonly (readonly AuditToken[])[] {
  const sentences: AuditToken[][] = [];
  let sentence: AuditToken[] = [];

  const flush = (): void => {
    if (sentence.length > 0) sentences.push(sentence);
    sentence = [];
  };

  for (const line of source.split("\n")) {
    if (line.length === 0) {
      flush();
      continue;
    }
    if (line.startsWith("#")) continue;
    const columns = line.split("\t");
    if (columns.length !== 10) continue;
    const rawId = columns[0] ?? "";
    if (!/^\d+$/u.test(rawId)) continue;
    const rawHead = columns[6] ?? "";
    if (!/^\d+$/u.test(rawHead)) {
      throw new Error(`invalid HEAD ${rawHead}`);
    }
    sentence.push({
      id: Number(rawId),
      head: Number(rawHead),
      relation: columns[7] ?? "",
      deps: parseEnhancedDependencies(columns[8] ?? "_"),
    });
  }
  flush();
  return sentences;
}

function isExternalSubjectRelation(relation: string): boolean {
  const parts = relation.split(":");
  return SUBJECT_RELATIONS.has(parts[0] ?? "") && parts.slice(1).includes("xsubj");
}

function controllerFor(
  matrixArguments: readonly AuditToken[],
  xcompId: number,
): { readonly kind: XcompControllerKind; readonly controllerId: number | null } {
  const targetHead = String(xcompId);
  const controllers = matrixArguments.filter((argument) =>
    argument.deps.some((edge) =>
      edge.head === targetHead && isExternalSubjectRelation(edge.relation)));

  if (controllers.length !== 1) return { kind: "unresolved", controllerId: null };

  const controller = controllers[0]!;
  const basicRelation = relationBase(controller.relation);
  if (SUBJECT_RELATIONS.has(basicRelation)) {
    return { kind: "subject", controllerId: controller.id };
  }
  if (OBJECT_RELATIONS.has(basicRelation)) {
    return { kind: "object", controllerId: controller.id };
  }
  return { kind: "other", controllerId: controller.id };
}

export function summarizeXcompControllerSourceEvidence(
  sources: readonly string[],
): XcompControllerSourceEvidenceSummary {
  const occurrences: XcompControllerOccurrence[] = [];
  let sentenceCount = 0;
  let tokenCount = 0;
  let enhancedXsubjEdgeCount = 0;

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const sentences = parseSource(sources[sourceIndex]!);
    sentenceCount += sentences.length;

    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      const sentence = sentences[sentenceIndex]!;
      tokenCount += sentence.length;
      const childrenByHead = new Map<number, AuditToken[]>();
      for (const token of sentence) {
        const children = childrenByHead.get(token.head) ?? [];
        children.push(token);
        childrenByHead.set(token.head, children);
        enhancedXsubjEdgeCount += token.deps.filter(
          (edge) => isExternalSubjectRelation(edge.relation),
        ).length;
      }

      for (const matrix of sentence) {
        const matrixChildren = childrenByHead.get(matrix.id) ?? [];
        const xcomps = matrixChildren.filter(
          (child) => relationBase(child.relation) === "xcomp",
        );
        if (xcomps.length === 0) continue;

        const matrixArguments = matrixChildren.filter((child) => {
          const base = relationBase(child.relation);
          return SUBJECT_RELATIONS.has(base) || OBJECT_RELATIONS.has(base);
        });
        const matrixHasObject = matrixArguments.some(
          (child) => OBJECT_RELATIONS.has(relationBase(child.relation)),
        );

        for (const xcomp of xcomps) {
          const controller = controllerFor(matrixArguments, xcomp.id);
          occurrences.push({
            sourceIndex,
            sentenceIndex,
            matrixId: matrix.id,
            xcompId: xcomp.id,
            controllerKind: controller.kind,
            controllerId: controller.controllerId,
            matrixHasObject,
          });
        }
      }
    }
  }

  const subjectControllerCount = occurrences.filter(
    (item) => item.controllerKind === "subject",
  ).length;
  const objectControllerCount = occurrences.filter(
    (item) => item.controllerKind === "object",
  ).length;
  const otherControllerCount = occurrences.filter(
    (item) => item.controllerKind === "other",
  ).length;
  const unresolvedCount = occurrences.filter(
    (item) => item.controllerKind === "unresolved",
  ).length;
  const basicObjectPlusXcompCount = occurrences.filter(
    (item) => item.matrixHasObject,
  ).length;
  const unresolvedBasicObjectPlusXcompCount = occurrences.filter(
    (item) => item.matrixHasObject && item.controllerKind === "unresolved",
  ).length;

  const digestPayload = occurrences.map((item) => ({
    sourceIndex: item.sourceIndex,
    sentenceIndex: item.sentenceIndex,
    matrixId: item.matrixId,
    xcompId: item.xcompId,
    controllerKind: item.controllerKind,
    controllerId: item.controllerId,
    matrixHasObject: item.matrixHasObject,
  }));
  const occurrenceDigest = createHash("sha256")
    .update(JSON.stringify(digestPayload), "utf8")
    .digest("hex");

  return {
    contract: XCOMP_CONTROLLER_SOURCE_EVIDENCE_CONTRACT,
    sourceVersion: UD_GSD_SOURCE_VERSION,
    sourceCommit: UD_GSD_SOURCE_COMMIT,
    sentenceCount,
    tokenCount,
    xcompCount: occurrences.length,
    subjectControllerCount,
    objectControllerCount,
    otherControllerCount,
    unresolvedCount,
    basicObjectPlusXcompCount,
    unresolvedBasicObjectPlusXcompCount,
    enhancedXsubjEdgeCount,
    occurrenceDigest,
    occurrences,
  };
}

export async function auditPinnedXcompControllerSourceEvidence():
Promise<XcompControllerSourceEvidenceSummary> {
  return summarizeXcompControllerSourceEvidence(
    await loadPinnedUdGsdOccurrenceSources(),
  );
}
