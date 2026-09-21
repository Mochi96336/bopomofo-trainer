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

function hasChildRelation(children: readonly UdOccurrenceToken[], relation: string): boolean {
  return children.some((child) => relationBase(child.relation) === relation);
}

const childUposCounts = new Map<string, number>();
const headUposCounts = new Map<string, number>();
const headRelationCounts = new Map<string, number>();
const surfaceOrderCounts = new Map<string, number>();
const headCoreArgumentPatterns = new Map<string, number>();
const formPairs = new Map<string, number>();
const childOwnRelationCounts = new Map<string, number>();
const examples: Array<{
  child: string;
  childUpos: string;
  head: string;
  headUpos: string;
  headRelation: string;
  childBeforeHead: boolean;
  headHasSubject: boolean;
  headHasObject: boolean;
  text: string;
}> = [];

let sentenceCount = 0;
let tokenCount = 0;
let dislocatedCount = 0;
let headRootCount = 0;
let verbalHeadCount = 0;

for (const source of await loadPinnedUdGsdOccurrenceSources()) {
  for (const sentence of parseUdOccurrenceSentences(source)) {
    sentenceCount += 1;
    tokenCount += sentence.length;
    const byId = new Map(sentence.map((token) => [token.id, token]));
    const childrenByHead = indexUdOccurrenceChildren(sentence);

    for (const child of sentence) {
      if (child.relation !== "dislocated") continue;
      dislocatedCount += 1;
      if (child.head === 0) throw new Error("dislocated token unexpectedly attaches to root index 0");
      const head = byId.get(child.head);
      if (head === undefined) throw new Error(`missing dislocated head ${child.head}`);

      const headChildren = childrenByHead.get(head.id) ?? [];
      const childChildren = childrenByHead.get(child.id) ?? [];
      const headHasSubject = hasChildRelation(headChildren, "nsubj")
        || hasChildRelation(headChildren, "csubj");
      const headHasObject = hasChildRelation(headChildren, "obj");
      const headRoot = head.head === 0 || head.relation === "root";
      const verbalHead = head.upos === "VERB" || head.upos === "AUX";

      if (headRoot) headRootCount += 1;
      if (verbalHead) verbalHeadCount += 1;
      increment(childUposCounts, child.upos);
      increment(headUposCounts, head.upos);
      increment(headRelationCounts, head.relation);
      increment(surfaceOrderCounts, child.id < head.id ? "child-before-head" : "child-after-head");
      increment(
        headCoreArgumentPatterns,
        headHasSubject && headHasObject
          ? "subject+object"
          : headHasSubject
            ? "subject-only"
            : headHasObject
              ? "object-only"
              : "neither",
      );
      increment(formPairs, `${child.form}\u0000${head.form}\u0000${child.upos}\u0000${head.upos}`);
      for (const ownChild of childChildren) increment(childOwnRelationCounts, ownChild.relation);

      if (examples.length < 40) {
        examples.push({
          child: child.form,
          childUpos: child.upos,
          head: head.form,
          headUpos: head.upos,
          headRelation: head.relation,
          childBeforeHead: child.id < head.id,
          headHasSubject,
          headHasObject,
          text: sentence.map((token) => token.form).join(""),
        });
      }
    }
  }
}

const topFormPairs = Object.fromEntries(
  [...formPairs]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 100),
);

console.log(JSON.stringify({
  contract: "pinned-gsd-topic-dislocation-inventory-v1",
  sentenceCount,
  tokenCount,
  dislocatedCount,
  headRootCount,
  verbalHeadCount,
  childUposCounts: sortedRecord(childUposCounts),
  headUposCounts: sortedRecord(headUposCounts),
  headRelationCounts: sortedRecord(headRelationCounts),
  surfaceOrderCounts: sortedRecord(surfaceOrderCounts),
  headCoreArgumentPatterns: sortedRecord(headCoreArgumentPatterns),
  childOwnRelationCounts: sortedRecord(childOwnRelationCounts),
  topFormPairs,
  examples,
}, null, 2));
