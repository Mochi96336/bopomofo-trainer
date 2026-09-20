import { writeFileSync } from "node:fs";
import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

const ASPECT_FORMS = new Set(["了", "過", "过", "著", "着"]);
const NEGATION_FORMS = new Set(["不", "沒", "没", "未", "別", "别", "非", "無", "无"]);
const MODAL_UPOS = new Set(["AUX"]);

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function hasSubject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const rel = relationBase(child.relation);
    return rel === "nsubj" || rel === "csubj";
  });
}

function hasObject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => relationBase(child.relation) === "obj");
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedRecord(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-Hant")));
}

interface Example {
  readonly sentence: string;
  readonly zaiIndex: number;
  readonly directChildren: readonly {
    readonly form: string;
    readonly upos: string;
    readonly relation: string;
    readonly side: "pre" | "post";
  }[];
}

const sources = await loadPinnedUdGsdOccurrenceSources();

let zaiVerb = 0;
let reviewedFrontier = 0;
let allAspectChild = 0;
let frontierAspectChild = 0;
let allNegationChild = 0;
let frontierNegationChild = 0;
let allAuxChild = 0;
let frontierAuxChild = 0;

const allAspectForms = new Map<string, number>();
const frontierAspectForms = new Map<string, number>();
const allNegationForms = new Map<string, number>();
const frontierNegationForms = new Map<string, number>();
const allAuxForms = new Map<string, number>();
const frontierAuxForms = new Map<string, number>();
const frontierChildRelationForms = new Map<string, number>();
const frontierExamples: Example[] = [];
const markedFrontierExamples: Example[] = [];
const allAspectExamples: Example[] = [];

for (const source of sources) {
  for (const sentence of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(sentence);
    const sentenceText = sentence.map((token) => token.form).join("");
    for (const token of sentence) {
      if (token.form !== "在" || token.upos !== "VERB") continue;
      zaiVerb += 1;
      const children = childrenByHead.get(token.id) ?? [];
      const root = token.head === 0 || token.relation === "root";
      const frontier = root && hasSubject(children) && hasObject(children);
      if (frontier) reviewedFrontier += 1;

      let hasAspect = false;
      let hasNegation = false;
      let hasAux = false;
      for (const child of children) {
        const key = `${child.relation}\u0000${child.upos}\u0000${child.form}\u0000${child.id < token.id ? "pre" : "post"}`;
        if (frontier) increment(frontierChildRelationForms, key);

        if (ASPECT_FORMS.has(child.form)) {
          hasAspect = true;
          increment(allAspectForms, `${child.form}\u0000${child.upos}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
          if (frontier) increment(frontierAspectForms, `${child.form}\u0000${child.upos}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
        }
        if (NEGATION_FORMS.has(child.form)) {
          hasNegation = true;
          increment(allNegationForms, `${child.form}\u0000${child.upos}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
          if (frontier) increment(frontierNegationForms, `${child.form}\u0000${child.upos}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
        }
        if (MODAL_UPOS.has(child.upos) && relationBase(child.relation) === "aux") {
          hasAux = true;
          increment(allAuxForms, `${child.form}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
          if (frontier) increment(frontierAuxForms, `${child.form}\u0000${child.relation}\u0000${child.id < token.id ? "pre" : "post"}`);
        }
      }

      if (hasAspect) {
        allAspectChild += 1;
        if (allAspectExamples.length < 20) {
          allAspectExamples.push({
            sentence: sentenceText,
            zaiIndex: token.id,
            directChildren: children.map((child) => ({
              form: child.form,
              upos: child.upos,
              relation: child.relation,
              side: child.id < token.id ? "pre" : "post",
            })),
          });
        }
      }
      if (hasNegation) allNegationChild += 1;
      if (hasAux) allAuxChild += 1;

      if (frontier) {
        if (hasAspect) frontierAspectChild += 1;
        if (hasNegation) frontierNegationChild += 1;
        if (hasAux) frontierAuxChild += 1;
        const example = {
          sentence: sentenceText,
          zaiIndex: token.id,
          directChildren: children.map((child) => ({
            form: child.form,
            upos: child.upos,
            relation: child.relation,
            side: child.id < token.id ? "pre" : "post" as const,
          })),
        };
        frontierExamples.push(example);
        if (hasAspect || hasNegation || hasAux) markedFrontierExamples.push(example);
      }
    }
  }
}

if (reviewedFrontier !== 12) {
  throw new Error(`reviewed verbal locative frontier drifted: expected 12, got ${reviewedFrontier}`);
}

const report = {
  schemaVersion: "locative-predicate-marking-evidence-audit-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  zaiVerbTokenCount: zaiVerb,
  reviewedFrontierTokenCount: reviewedFrontier,
  allZaiVerb: {
    aspectChildTokenCount: allAspectChild,
    negationChildTokenCount: allNegationChild,
    auxiliaryChildTokenCount: allAuxChild,
    aspectForms: sortedRecord(allAspectForms),
    negationForms: sortedRecord(allNegationForms),
    auxiliaryForms: sortedRecord(allAuxForms),
  },
  reviewedFrontier: {
    aspectChildTokenCount: frontierAspectChild,
    negationChildTokenCount: frontierNegationChild,
    auxiliaryChildTokenCount: frontierAuxChild,
    aspectForms: sortedRecord(frontierAspectForms),
    negationForms: sortedRecord(frontierNegationForms),
    auxiliaryForms: sortedRecord(frontierAuxForms),
    directChildShapes: sortedRecord(frontierChildRelationForms),
    examples: frontierExamples,
    markedExamples: markedFrontierExamples,
  },
  allAspectExamples,
  interpretationBoundary: {
    corpusAttestationOnly: true,
    note: "Zero count does not prove ungrammaticality; it does show which Predicate-marking combinations are not licensed by the reviewed same-occurrence corpus contract.",
  },
};

writeFileSync("locative-predicate-marking-evidence-audit.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
