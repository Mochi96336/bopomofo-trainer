import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

const ASPECT_FORMS = new Set(["了", "過", "过", "著", "着"]);
function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}
function hasSubject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const base = relationBase(child.relation);
    return base === "nsubj" || base === "csubj";
  });
}
function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
function sorted(map: ReadonlyMap<string, number>): Record<string, number> {
  return Object.fromEntries([...map].sort(([a],[b]) => a.localeCompare(b, "zh-Hant")));
}

let zaiVerbCount=0;
let reviewedCount=0;
let anyAspectChild=0;
let reviewedAnyAspectChild=0;
const directAspectForms=new Map<string,number>();
const reviewedDirectAspectForms=new Map<string,number>();
const aspectRelations=new Map<string,number>();
const reviewedAspectRelations=new Map<string,number>();
const aspectFeats=new Map<string,number>();
const reviewedAspectFeats=new Map<string,number>();
const reviewedExamples: Array<{tokens:string; aspectChildren:Array<{form:string;upos:string;relation:string;feats:string}>}> = [];

for (const source of await loadPinnedUdGsdOccurrenceSources()) {
  for (const sentence of parseUdOccurrenceSentences(source)) {
    const childrenByHead=indexUdOccurrenceChildren(sentence);
    for (const token of sentence) {
      if (token.form!=="在" || token.upos!=="VERB") continue;
      zaiVerbCount++;
      const children=childrenByHead.get(token.id) ?? [];
      const root=token.head===0 || token.relation==="root";
      const reviewed=root && hasSubject(children)
        && children.some((child)=>relationBase(child.relation)==="obj");
      if (reviewed) reviewedCount++;

      const aspectChildren=children.filter((child)=>
        ASPECT_FORMS.has(child.form)
        || child.feats.includes("Aspect=")
        || child.relation.includes("aspect")
      );
      if (aspectChildren.length>0) {
        anyAspectChild++;
        if (reviewed) reviewedAnyAspectChild++;
      }
      for (const child of aspectChildren) {
        increment(directAspectForms, child.form);
        increment(aspectRelations, child.relation);
        increment(aspectFeats, child.feats);
        if (reviewed) {
          increment(reviewedDirectAspectForms, child.form);
          increment(reviewedAspectRelations, child.relation);
          increment(reviewedAspectFeats, child.feats);
        }
      }
      if (reviewed) {
        reviewedExamples.push({
          tokens: sentence.map((t)=>t.form).join(""),
          aspectChildren: aspectChildren.map(({form,upos,relation,feats})=>({form,upos,relation,feats})),
        });
      }
    }
  }
}

console.log(JSON.stringify({
  zaiVerbCount,
  reviewedRootSubjectObjectCount: reviewedCount,
  zaiVerbWithDirectAspectEvidence: anyAspectChild,
  reviewedWithDirectAspectEvidence: reviewedAnyAspectChild,
  directAspectForms: sorted(directAspectForms),
  reviewedDirectAspectForms: sorted(reviewedDirectAspectForms),
  aspectRelations: sorted(aspectRelations),
  reviewedAspectRelations: sorted(reviewedAspectRelations),
  aspectFeats: sorted(aspectFeats),
  reviewedAspectFeats: sorted(reviewedAspectFeats),
  reviewedExamples,
}, null, 2));
