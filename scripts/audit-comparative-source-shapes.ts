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

const allBiUposRelations = new Map<string, number>();
const standardHeadUposRelations = new Map<string, number>();
const governingPredicateUposRelations = new Map<string, number>();
const governingPredicateUpos = new Map<string, number>();
const markerStandardOrder = new Map<string, number>();
const standardPredicateOrder = new Map<string, number>();
const predicateSubjectCounts = new Map<string, number>();
const predicateRootCounts = new Map<string, number>();
const formTriples = new Map<string, number>();
const examples: Array<{
  marker: string;
  standard: string;
  standardUpos: string;
  standardRelation: string;
  predicate: string | null;
  predicateUpos: string | null;
  predicateRelation: string | null;
  predicateHasSubject: boolean;
  markerBeforeStandard: boolean;
  standardBeforePredicate: boolean | null;
  text: string;
}> = [];

let sentenceCount = 0;
let tokenCount = 0;
let biTokenCount = 0;
let exactCaseAdpCount = 0;
let nominalStandardCount = 0;
let governingPredicateCount = 0;
let adjectivalPredicateCount = 0;
let verbalPredicateCount = 0;

for (const source of await loadPinnedUdGsdOccurrenceSources()) {
  for (const sentence of parseUdOccurrenceSentences(source)) {
    sentenceCount += 1;
    tokenCount += sentence.length;
    const byId = new Map(sentence.map((token) => [token.id, token]));
    const childrenByHead = indexUdOccurrenceChildren(sentence);

    for (const marker of sentence) {
      if (marker.form !== "比") continue;
      biTokenCount += 1;
      increment(allBiUposRelations, `${marker.upos}\u0000${marker.relation}`);

      if (marker.upos !== "ADP" || marker.relation !== "case") continue;
      exactCaseAdpCount += 1;
      if (marker.head === 0) throw new Error("比/ADP(case) unexpectedly attaches to root index 0");
      const standard = byId.get(marker.head);
      if (standard === undefined) throw new Error(`missing 比 standard head ${marker.head}`);

      const nominalStandard = standard.upos === "NOUN"
        || standard.upos === "PROPN"
        || standard.upos === "PRON"
        || standard.upos === "NUM";
      if (nominalStandard) nominalStandardCount += 1;

      increment(standardHeadUposRelations, `${standard.upos}\u0000${standard.relation}`);
      increment(markerStandardOrder, marker.id < standard.id ? "marker-before-standard" : "marker-after-standard");

      const predicate = standard.head === 0 ? undefined : byId.get(standard.head);
      if (predicate !== undefined) {
        governingPredicateCount += 1;
        increment(governingPredicateUposRelations, `${predicate.upos}\u0000${predicate.relation}`);
        increment(governingPredicateUpos, predicate.upos);
        increment(standardPredicateOrder, standard.id < predicate.id ? "standard-before-predicate" : "standard-after-predicate");
        const predicateChildren = childrenByHead.get(predicate.id) ?? [];
        increment(predicateSubjectCounts, hasSubject(predicateChildren) ? "with-subject" : "without-subject");
        increment(predicateRootCounts, predicate.head === 0 || predicate.relation === "root" ? "root" : "non-root");
        if (predicate.upos === "ADJ") adjectivalPredicateCount += 1;
        if (predicate.upos === "VERB") verbalPredicateCount += 1;
        increment(formTriples, `${marker.form}\u0000${standard.form}\u0000${predicate.form}\u0000${predicate.upos}`);
      }

      if (examples.length < 40) {
        const predicateChildren = predicate === undefined ? [] : (childrenByHead.get(predicate.id) ?? []);
        examples.push({
          marker: marker.form,
          standard: standard.form,
          standardUpos: standard.upos,
          standardRelation: standard.relation,
          predicate: predicate?.form ?? null,
          predicateUpos: predicate?.upos ?? null,
          predicateRelation: predicate?.relation ?? null,
          predicateHasSubject: predicate === undefined ? false : hasSubject(predicateChildren),
          markerBeforeStandard: marker.id < standard.id,
          standardBeforePredicate: predicate === undefined ? null : standard.id < predicate.id,
          text: sentence.map((token) => token.form).join(""),
        });
      }
    }
  }
}

const topFormTriples = Object.fromEntries(
  [...formTriples]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 100),
);

console.log(JSON.stringify({
  contract: "pinned-gsd-bi-comparative-shape-inventory-v1",
  sentenceCount,
  tokenCount,
  biTokenCount,
  exactCaseAdpCount,
  nominalStandardCount,
  governingPredicateCount,
  adjectivalPredicateCount,
  verbalPredicateCount,
  allBiUposRelations: sortedRecord(allBiUposRelations),
  standardHeadUposRelations: sortedRecord(standardHeadUposRelations),
  governingPredicateUposRelations: sortedRecord(governingPredicateUposRelations),
  governingPredicateUpos: sortedRecord(governingPredicateUpos),
  markerStandardOrder: sortedRecord(markerStandardOrder),
  standardPredicateOrder: sortedRecord(standardPredicateOrder),
  predicateSubjectCounts: sortedRecord(predicateSubjectCounts),
  predicateRootCounts: sortedRecord(predicateRootCounts),
  topFormTriples,
  examples,
}, null, 2));
