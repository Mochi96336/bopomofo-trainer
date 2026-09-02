import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { BA_MARKERS } from "./ba-occurrence-source.js";
import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

const ASPECT_FORMS = new Set(["了", "著", "過"]);
const COMPLETION_BASE_RELATIONS = new Set(["aux", "xcomp", "ccomp", "compound", "obl"]);
const STRONG_COMPLETION_BASE_RELATIONS = new Set(["xcomp", "ccomp", "compound"]);

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function top(map: ReadonlyMap<string, number>, limit = 30): readonly [string, number][] {
  return [...map].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant")).slice(0, limit);
}

function directBaMarkers(
  patient: UdOccurrenceToken,
  childrenByHead: ReadonlyMap<number, readonly UdOccurrenceToken[]>,
): readonly UdOccurrenceToken[] {
  return (childrenByHead.get(patient.id) ?? []).filter((candidate) =>
    candidate.relation === "case"
    && candidate.upos === "ADP"
    && BA_MARKERS.includes(candidate.form as (typeof BA_MARKERS)[number]),
  );
}

function nonPatientChildren(
  predicate: UdOccurrenceToken,
  childrenByHead: ReadonlyMap<number, readonly UdOccurrenceToken[]>,
): readonly UdOccurrenceToken[] {
  return (childrenByHead.get(predicate.id) ?? []).filter((child) =>
    child.relation !== "obl:patient" && relationBase(child.relation) !== "punct",
  );
}

function hasCompletion(children: readonly UdOccurrenceToken[], predicateId: number): boolean {
  return children.some((child) =>
    child.id > predicateId && COMPLETION_BASE_RELATIONS.has(relationBase(child.relation)),
  );
}

function hasStrongCompletion(children: readonly UdOccurrenceToken[], predicateId: number): boolean {
  return children.some((child) =>
    child.id > predicateId
    && (STRONG_COMPLETION_BASE_RELATIONS.has(relationBase(child.relation))
      || ASPECT_FORMS.has(child.form)),
  );
}

const sources = await loadPinnedUdGsdOccurrenceSources();
const baKeys = new Set<string>();
const objectKeys = new Set<string>();
const objectPlusCompletionKeys = new Set<string>();
const objectPlusStrongCompletionKeys = new Set<string>();
const baOccurrencePredicateKeys: string[] = [];

const predicateUposCounts = new Map<string, number>();
const predicateRelationCounts = new Map<string, number>();
const predicateFeatCounts = new Map<string, number>();
const directChildRelationTokenCounts = new Map<string, number>();
const directChildRelationOccurrenceCounts = new Map<string, number>();
const rightChildRelationTokenCounts = new Map<string, number>();
const rightChildRelationOccurrenceCounts = new Map<string, number>();
const rightChildFormRelationCounts = new Map<string, number>();
const childRelationSignatures = new Map<string, number>();
const rightChildRelationSignatures = new Map<string, number>();
const markerCounts = new Map<string, number>();
const structuralBucketCounts = new Map<string, number>();
let baOccurrenceCount = 0;

for (const source of sources) {
  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);

    for (const predicate of tokens) {
      if (predicate.upos !== "VERB") continue;
      const children = childrenByHead.get(predicate.id) ?? [];
      const objectBearing = children.some((child) => child.relation === "obj" || child.relation === "iobj");
      const predicateChildren = nonPatientChildren(predicate, childrenByHead);
      const key = lexemeUposKey(predicate.form, predicate.upos);
      if (objectBearing) {
        objectKeys.add(key);
        if (hasCompletion(predicateChildren, predicate.id)) objectPlusCompletionKeys.add(key);
        if (hasStrongCompletion(predicateChildren, predicate.id)) objectPlusStrongCompletionKeys.add(key);
      }

      const patients = children.filter((child) => child.relation === "obl:patient");
      const markers = patients.flatMap((patient) => directBaMarkers(patient, childrenByHead));
      if (markers.length === 0) continue;

      baOccurrenceCount += 1;
      baKeys.add(key);
      baOccurrencePredicateKeys.push(key);
      increment(predicateUposCounts, predicate.upos);
      increment(predicateRelationCounts, predicate.relation);
      for (const marker of markers) increment(markerCounts, marker.form);
      for (const feat of predicate.feats === "_" ? [] : predicate.feats.split("|")) increment(predicateFeatCounts, feat);

      const relationSet = new Set<string>();
      const rightRelationSet = new Set<string>();
      for (const child of predicateChildren) {
        relationSet.add(child.relation);
        increment(directChildRelationTokenCounts, child.relation);
        if (child.id > predicate.id) {
          rightRelationSet.add(child.relation);
          increment(rightChildRelationTokenCounts, child.relation);
          increment(rightChildFormRelationCounts, `${child.form}\t${child.upos}\t${child.relation}`);
        }
      }
      for (const relation of relationSet) increment(directChildRelationOccurrenceCounts, relation);
      for (const relation of rightRelationSet) increment(rightChildRelationOccurrenceCounts, relation);
      increment(childRelationSignatures, [...relationSet].sort().join("|") || "<bare-after-patient>");
      increment(rightChildRelationSignatures, [...rightRelationSet].sort().join("|") || "<no-right-dependent>");

      const rightChildren = predicateChildren.filter((child) => child.id > predicate.id);
      const flags: readonly [string, boolean][] = [
        ["has-any-right-dependent", rightChildren.length > 0],
        ["has-right-aux-or-part", rightChildren.some((child) => child.upos === "AUX" || child.upos === "PART")],
        ["has-right-known-aspect-form", rightChildren.some((child) => ASPECT_FORMS.has(child.form))],
        ["has-right-completion-relation", hasCompletion(predicateChildren, predicate.id)],
        ["has-right-strong-completion", hasStrongCompletion(predicateChildren, predicate.id)],
        ["has-right-xcomp", rightChildren.some((child) => relationBase(child.relation) === "xcomp")],
        ["has-right-ccomp", rightChildren.some((child) => relationBase(child.relation) === "ccomp")],
        ["has-right-compound", rightChildren.some((child) => relationBase(child.relation) === "compound")],
        ["has-right-obl", rightChildren.some((child) => relationBase(child.relation) === "obl")],
        ["has-right-aux", rightChildren.some((child) => relationBase(child.relation) === "aux")],
      ];
      for (const [name, enabled] of flags) if (enabled) increment(structuralBucketCounts, name);
    }
  }
}

const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
const packagedVerbProfiles = SYNTAX_PROFILES.filter((profile) => profile.upos === "VERB");

function profilesForSourceKeys(keys: ReadonlySet<string>) {
  return packagedVerbProfiles.filter((profile) => {
    const text = textByEntryId.get(profile.entryId);
    return text !== undefined && keys.has(lexemeUposKey(text, profile.upos));
  });
}

function summarizeProfiles(profiles: readonly (typeof SYNTAX_PROFILES)[number][]) {
  return {
    profiles: profiles.length,
    entries: new Set(profiles.map((profile) => profile.entryId)).size,
    surfaceForms: new Set(profiles.map((profile) => textByEntryId.get(profile.entryId)).filter(Boolean)).size,
  };
}

function baOccurrenceRecall(keys: ReadonlySet<string>): number {
  return baOccurrencePredicateKeys.filter((key) => keys.has(key)).length / baOccurrencePredicateKeys.length;
}

function baLexemeRecall(keys: ReadonlySet<string>): number {
  const matched = [...baKeys].filter((key) => keys.has(key)).length;
  return matched / baKeys.size;
}

function union(...sets: readonly ReadonlySet<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

const candidateSets = {
  "ba-attested-only": baKeys,
  "direct-object-observed": objectKeys,
  "ba-or-direct-object": union(baKeys, objectKeys),
  "object-plus-right-completion-same-occurrence": objectPlusCompletionKeys,
  "ba-or-object-plus-right-completion": union(baKeys, objectPlusCompletionKeys),
  "object-plus-strong-completion-same-occurrence": objectPlusStrongCompletionKeys,
  "ba-or-object-plus-strong-completion": union(baKeys, objectPlusStrongCompletionKeys),
} as const;

const candidateSummary = Object.fromEntries(Object.entries(candidateSets).map(([name, keys]) => {
  const profiles = profilesForSourceKeys(keys);
  return [name, {
    sourceLexemeUposKeys: keys.size,
    packagedFrontier: summarizeProfiles(profiles),
    baOccurrenceRecall: baOccurrenceRecall(keys),
    baLexemeUposRecall: baLexemeRecall(keys),
  }];
}));

const oldCanonical = packagedVerbProfiles.filter((profile) =>
  profile.valencyFrames.includes("transitive") || profile.valencyFrames.includes("ambitransitive"),
);

const runtimeAggregateCompletion = oldCanonical.filter((profile) => {
  const counts = profile.dependencyEvidence.childRelationCounts ?? {};
  return Object.keys(counts).some((relation) =>
    (counts[relation] ?? 0) > 0 && COMPLETION_BASE_RELATIONS.has(relationBase(relation)),
  );
});
const runtimeAggregateStrongCompletion = oldCanonical.filter((profile) => {
  const counts = profile.dependencyEvidence.childRelationCounts ?? {};
  return Object.keys(counts).some((relation) =>
    (counts[relation] ?? 0) > 0 && STRONG_COMPLETION_BASE_RELATIONS.has(relationBase(relation)),
  );
});

const result = {
  auditVersion: "ba-structural-licensing-discovery-v1",
  baOccurrenceCount,
  baLexemeUposCount: baKeys.size,
  discovery: {
    predicateUposCounts: Object.fromEntries(top(predicateUposCounts)),
    markerCounts: Object.fromEntries(top(markerCounts)),
    predicateRelationCounts: Object.fromEntries(top(predicateRelationCounts)),
    predicateFeatCounts: Object.fromEntries(top(predicateFeatCounts)),
    structuralBucketCounts: Object.fromEntries(top(structuralBucketCounts)),
    structuralBucketRates: Object.fromEntries([...structuralBucketCounts].map(([name, count]) => [name, count / baOccurrenceCount])),
    topDirectChildRelationsByToken: top(directChildRelationTokenCounts),
    topDirectChildRelationsByOccurrence: top(directChildRelationOccurrenceCounts),
    topRightChildRelationsByToken: top(rightChildRelationTokenCounts),
    topRightChildRelationsByOccurrence: top(rightChildRelationOccurrenceCounts),
    topRightChildForms: top(rightChildFormRelationCounts, 50),
    topChildRelationSignatures: top(childRelationSignatures, 30),
    topRightChildRelationSignatures: top(rightChildRelationSignatures, 30),
  },
  candidateSummary,
  packagedBaselines: {
    packagedEntries: PRACTICE_CATALOG.length,
    packagedProfiles: SYNTAX_PROFILES.length,
    packagedVerbProfiles: packagedVerbProfiles.length,
    oldCanonicalTransitiveOrAmbitransitive: summarizeProfiles(oldCanonical),
    oldCanonicalWithAggregateCompletionEvidence: summarizeProfiles(runtimeAggregateCompletion),
    oldCanonicalWithAggregateStrongCompletionEvidence: summarizeProfiles(runtimeAggregateStrongCompletion),
  },
};

console.log(JSON.stringify(result, null, 2));
