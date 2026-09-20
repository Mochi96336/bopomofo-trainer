import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function increment(target: Map<string, number>, key: string): void {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function sortedRecord(values: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...values].sort(([left], [right]) => left.localeCompare(right, "zh-Hant")));
}

function hasSubject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => {
    const relation = relationBase(child.relation);
    return relation === "nsubj" || relation === "csubj";
  });
}

function hasObject(children: readonly UdOccurrenceToken[]): boolean {
  return children.some((child) => relationBase(child.relation) === "obj");
}

function hasChildRelation(children: readonly UdOccurrenceToken[], base: string): boolean {
  return children.some((child) => relationBase(child.relation) === base);
}

interface Example {
  readonly relation: string;
  readonly head: string;
  readonly child: string;
  readonly headRoot: boolean;
  readonly headHasSubject: boolean;
  readonly childHasSubject: boolean;
  readonly headHasObject: boolean;
  readonly childHasObject: boolean;
  readonly childHasCc: boolean;
  readonly childHasMark: boolean;
  readonly text: string;
}

const directVerbPairRelations = new Map<string, number>();
const rootHeadPairRelations = new Map<string, number>();
const headSubjectChildNoSubjectRelations = new Map<string, number>();
const childOvertSubjectRelations = new Map<string, number>();
const headObjectRelations = new Map<string, number>();
const childObjectRelations = new Map<string, number>();
const childCcRelations = new Map<string, number>();
const childMarkRelations = new Map<string, number>();
const headChildFormPairs = new Map<string, number>();
const examplesByRelation = new Map<string, Example[]>();

let sentenceCount = 0;
let tokenCount = 0;
let verbTokenCount = 0;
let directVerbPairCount = 0;

for (const source of await loadPinnedUdGsdOccurrenceSources()) {
  for (const sentence of parseUdOccurrenceSentences(source)) {
    sentenceCount += 1;
    tokenCount += sentence.length;
    const byId = new Map(sentence.map((token) => [token.id, token]));
    const childrenByHead = indexUdOccurrenceChildren(sentence);
    for (const child of sentence) {
      if (child.upos !== "VERB") continue;
      verbTokenCount += 1;
      if (child.head === 0) continue;
      const head = byId.get(child.head);
      if (head?.upos !== "VERB") continue;

      directVerbPairCount += 1;
      const relation = child.relation;
      const headChildren = childrenByHead.get(head.id) ?? [];
      const childChildren = childrenByHead.get(child.id) ?? [];
      const headRoot = head.head === 0 || head.relation === "root";
      const headHasSubject = hasSubject(headChildren);
      const childHasSubject = hasSubject(childChildren);
      const headHasObject = hasObject(headChildren);
      const childHasObject = hasObject(childChildren);
      const childHasCc = hasChildRelation(childChildren, "cc");
      const childHasMark = hasChildRelation(childChildren, "mark");

      increment(directVerbPairRelations, relation);
      if (headRoot) increment(rootHeadPairRelations, relation);
      if (headHasSubject && !childHasSubject) increment(headSubjectChildNoSubjectRelations, relation);
      if (childHasSubject) increment(childOvertSubjectRelations, relation);
      if (headHasObject) increment(headObjectRelations, relation);
      if (childHasObject) increment(childObjectRelations, relation);
      if (childHasCc) increment(childCcRelations, relation);
      if (childHasMark) increment(childMarkRelations, relation);
      increment(headChildFormPairs, `${head.form}\u0000${child.form}\u0000${relation}`);

      const examples = examplesByRelation.get(relation) ?? [];
      if (examples.length < 12) {
        examples.push({
          relation,
          head: head.form,
          child: child.form,
          headRoot,
          headHasSubject,
          childHasSubject,
          headHasObject,
          childHasObject,
          childHasCc,
          childHasMark,
          text: sentence.map((token) => token.form).join(""),
        });
        examplesByRelation.set(relation, examples);
      }
    }
  }
}

const topFormPairs = Object.fromEntries(
  [...headChildFormPairs]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 100),
);
const examples = Object.fromEntries(
  [...examplesByRelation].sort(([left], [right]) => left.localeCompare(right)),
);

console.log(JSON.stringify({
  contract: "pinned-gsd-direct-verb-pair-inventory-v1",
  sentenceCount,
  tokenCount,
  verbTokenCount,
  directVerbPairCount,
  directVerbPairRelations: sortedRecord(directVerbPairRelations),
  rootHeadPairRelations: sortedRecord(rootHeadPairRelations),
  headSubjectChildNoSubjectRelations: sortedRecord(headSubjectChildNoSubjectRelations),
  childOvertSubjectRelations: sortedRecord(childOvertSubjectRelations),
  headObjectRelations: sortedRecord(headObjectRelations),
  childObjectRelations: sortedRecord(childObjectRelations),
  childCcRelations: sortedRecord(childCcRelations),
  childMarkRelations: sortedRecord(childMarkRelations),
  topFormPairs,
  examples,
}, null, 2));
