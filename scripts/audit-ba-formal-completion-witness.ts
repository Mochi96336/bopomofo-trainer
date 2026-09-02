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

function hasBaMarker(patient: UdOccurrenceToken, childrenByHead: ReadonlyMap<number, readonly UdOccurrenceToken[]>): boolean {
  return (childrenByHead.get(patient.id) ?? []).some((child) =>
    child.relation === "case"
      && child.upos === "ADP"
      && BA_MARKERS.includes(child.form as (typeof BA_MARKERS)[number]),
  );
}

function hasAspectFeature(token: UdOccurrenceToken): boolean {
  return token.feats !== "_" && token.feats.split("|").some((feature) => feature.startsWith("Aspect="));
}

function witnessKind(child: UdOccurrenceToken, predicateId: number): string | null {
  if (child.id <= predicateId) return null;
  const relation = base(child.relation);
  if (child.relation === "obj" || child.relation === "iobj") return "postverbal-argument";
  if (relation === "xcomp" || relation === "ccomp") return "clausal-complement";
  if (relation === "obl") return "oblique-complement";
  if (child.relation === "compound:ext") return "extension-compound";
  if (relation === "aux" && hasAspectFeature(child)) return "aspect";
  // GSD conversion represents productive postverbal linkers/directionals such
  // as 為/在/成/到/給/至/起來/下去 as VERB+mark. Restricting to VERB excludes
  // temporal ADP markers such as 後/之後 and SCONJ relative/clause markers.
  if (relation === "mark" && child.upos === "VERB") return "verbal-completion-marker";
  return null;
}

let verbBaOccurrences = 0;
let covered = 0;
const kindCounts = new Map<string, number>();
const uncovered: Array<Record<string, unknown>> = [];
const coveredSamples = new Map<string, Array<Record<string, unknown>>>();

function increment(key: string) {
  kindCounts.set(key, (kindCounts.get(key) ?? 0) + 1);
}
function sample(key: string, value: Record<string, unknown>) {
  const values = coveredSamples.get(key) ?? [];
  if (values.length < 5) values.push(value);
  coveredSamples.set(key, values);
}

for (const source of await loadPinnedUdGsdOccurrenceSources()) {
  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    const sentence = tokens.map((token) => token.form).join("");
    for (const predicate of tokens) {
      if (predicate.upos !== "VERB") continue;
      const children = childrenByHead.get(predicate.id) ?? [];
      if (!children.some((child) => child.relation === "obl:patient" && hasBaMarker(child, childrenByHead))) continue;
      verbBaOccurrences += 1;
      const witnesses = children
        .map((child) => ({ child, kind: witnessKind(child, predicate.id) }))
        .filter((value): value is { child: UdOccurrenceToken; kind: string } => value.kind !== null);
      const kinds = [...new Set(witnesses.map((value) => value.kind))].sort();
      if (kinds.length > 0) {
        covered += 1;
        for (const kind of kinds) increment(kind);
        sample(kinds.join("+"), {
          sentence,
          predicate: predicate.form,
          witnesses: witnesses.map(({ child, kind }) => `${kind}:${child.form}/${child.upos}/${child.relation}/${child.feats}`),
        });
      } else if (uncovered.length < 80) {
        uncovered.push({
          sentence,
          predicate: predicate.form,
          rightChildren: children
            .filter((child) => child.id > predicate.id && base(child.relation) !== "punct")
            .map((child) => `${child.form}/${child.upos}/${child.relation}/${child.feats}`),
        });
      }
    }
  }
}

console.log(JSON.stringify({
  auditVersion: "ba-formal-completion-witness-v1",
  verbBaOccurrences,
  covered,
  uncovered: verbBaOccurrences - covered,
  coverageRate: covered / verbBaOccurrences,
  witnessOccurrenceCounts: Object.fromEntries([...kindCounts].sort((a, b) => b[1] - a[1])),
  coveredSamples: Object.fromEntries([...coveredSamples].sort(([a], [b]) => a.localeCompare(b))),
  uncoveredExamples: uncovered,
}, null, 2));
