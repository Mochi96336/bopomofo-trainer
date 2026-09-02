import { BA_MARKERS } from "./ba-occurrence-source.js";
import {
  indexUdOccurrenceChildren,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

function base(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function baMarkerFor(patient: UdOccurrenceToken, childrenByHead: ReadonlyMap<number, readonly UdOccurrenceToken[]>) {
  return (childrenByHead.get(patient.id) ?? []).find((child) =>
    child.relation === "case"
      && child.upos === "ADP"
      && BA_MARKERS.includes(child.form as (typeof BA_MARKERS)[number]),
  );
}

const byShape = new Map<string, Array<Record<string, unknown>>>();
const markerObjectPairCounts = new Map<string, number>();
const markerObjectExamples = new Map<string, Array<Record<string, unknown>>>();

function pushSample(map: Map<string, Array<Record<string, unknown>>>, key: string, value: Record<string, unknown>, limit = 8) {
  const list = map.get(key) ?? [];
  if (list.length < limit) list.push(value);
  map.set(key, list);
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const sources = await loadPinnedUdGsdOccurrenceSources();
for (const source of sources) {
  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    const sentence = tokens.map((token) => token.form).join("");
    for (const predicate of tokens) {
      if (predicate.upos !== "VERB") continue;
      const children = childrenByHead.get(predicate.id) ?? [];
      const patient = children.find((child) => child.relation === "obl:patient" && baMarkerFor(child, childrenByHead));
      if (patient === undefined) continue;
      const right = children.filter((child) => child.id > predicate.id && base(child.relation) !== "punct");
      const markers = right.filter((child) => base(child.relation) === "mark" && (child.upos === "VERB" || child.upos === "ADP"));
      const args = right.filter((child) => child.relation === "obj" || child.relation === "iobj");
      const aspect = right.filter((child) => child.relation === "aux" && child.upos === "AUX");
      const clauses = right.filter((child) => base(child.relation) === "xcomp" || base(child.relation) === "ccomp");
      const obliques = right.filter((child) => base(child.relation) === "obl");
      const compounds = right.filter((child) => base(child.relation) === "compound");

      const shape = [
        markers.length ? "marker" : null,
        args.length ? "arg" : null,
        aspect.length ? "aspect" : null,
        clauses.length ? "clause" : null,
        obliques.length ? "obl" : null,
        compounds.length ? "compound" : null,
      ].filter((item): item is string => item !== null).join("+") || "lexical/bare";

      pushSample(byShape, shape, {
        sentence,
        predicate: predicate.form,
        patient: patient.form,
        marker: baMarkerFor(patient, childrenByHead)?.form,
        right: right.map((child) => `${child.form}/${child.upos}/${child.relation}`),
      });

      for (const marker of markers) {
        for (const arg of args) {
          const pair = `${marker.form}/${marker.upos}/${marker.relation} + ${arg.upos}/${arg.relation}`;
          increment(markerObjectPairCounts, pair);
          pushSample(markerObjectExamples, pair, {
            sentence,
            predicate: predicate.form,
            patient: patient.form,
            marker: marker.form,
            argument: arg.form,
          }, 4);
        }
      }
    }
  }
}

const result = {
  auditVersion: "ba-completion-shapes-v1",
  representativeByShape: Object.fromEntries([...byShape].sort(([a], [b]) => a.localeCompare(b))),
  markerArgumentPairs: [...markerObjectPairCounts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 30)
    .map(([pair, count]) => ({ pair, count, examples: markerObjectExamples.get(pair) ?? [] })),
};

console.log(JSON.stringify(result, null, 2));
