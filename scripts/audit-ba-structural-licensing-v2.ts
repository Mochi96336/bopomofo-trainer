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
const GENERIC_EXTENSION_RELATIONS = new Set(["aux", "xcomp", "ccomp", "compound", "obl"]);

function relationBase(relation: string): string {
  return relation.split(":", 1)[0] ?? relation;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: ReadonlyMap<string, number>, limit = 30): readonly [string, number][] {
  return [...map]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, limit);
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

function isGenericFormalExtension(child: UdOccurrenceToken, predicateId: number): boolean {
  if (child.id <= predicateId) return false;
  const base = relationBase(child.relation);
  return GENERIC_EXTENSION_RELATIONS.has(base)
    || (base === "mark" && (child.upos === "VERB" || child.upos === "ADP"))
    || ASPECT_FORMS.has(child.form);
}

function isBaPostverbalExtension(child: UdOccurrenceToken, predicateId: number): boolean {
  if (isGenericFormalExtension(child, predicateId)) return true;
  if (child.id <= predicateId) return false;
  const base = relationBase(child.relation);
  return base === "obj" || base === "iobj";
}

const sources = await loadPinnedUdGsdOccurrenceSources();
const allBaKeys = new Set<string>();
const verbBaKeys = new Set<string>();
const objectKeys = new Set<string>();
const genericExtensionKeys = new Set<string>();
const objectPlusGenericExtensionKeys = new Set<string>();
const verbBaOccurrenceKeys: string[] = [];
const nonVerbBaOccurrences: Array<Record<string, unknown>> = [];
const uncoveredVerbBaOccurrences: Array<Record<string, unknown>> = [];
const baShapeCounts = new Map<string, number>();
const baExtensionFormCounts = new Map<string, number>();
const baExtensionRelationCounts = new Map<string, number>();
let allBaOccurrenceCount = 0;
let verbBaOccurrenceCount = 0;
let verbBaWithGenericExtensionCount = 0;
let verbBaWithAnyPostverbalExtensionCount = 0;
let verbBaWithPostverbalObjectCount = 0;
let verbBaWithPostverbalMarkerCount = 0;
let verbBaWithAspectCount = 0;

for (const source of sources) {
  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    const surface = tokens.map((token) => token.form).join("");

    for (const predicate of tokens) {
      const children = childrenByHead.get(predicate.id) ?? [];
      const key = lexemeUposKey(predicate.form, predicate.upos);

      if (predicate.upos === "VERB") {
        const hasObject = children.some((child) => child.relation === "obj" || child.relation === "iobj");
        const hasGenericExtension = children.some((child) => isGenericFormalExtension(child, predicate.id));
        if (hasObject) objectKeys.add(key);
        if (hasGenericExtension) genericExtensionKeys.add(key);
        if (hasObject && hasGenericExtension) objectPlusGenericExtensionKeys.add(key);
      }

      const patients = children.filter((child) => child.relation === "obl:patient");
      const markers = patients.flatMap((patient) => directBaMarkers(patient, childrenByHead));
      if (markers.length === 0) continue;

      allBaOccurrenceCount += 1;
      allBaKeys.add(key);
      if (predicate.upos !== "VERB") {
        nonVerbBaOccurrences.push({
          predicate: predicate.form,
          upos: predicate.upos,
          relation: predicate.relation,
          markers: markers.map((marker) => marker.form),
          sentence: surface,
        });
        continue;
      }

      verbBaOccurrenceCount += 1;
      verbBaKeys.add(key);
      verbBaOccurrenceKeys.push(key);
      const rightChildren = children.filter((child) => child.id > predicate.id && relationBase(child.relation) !== "punct");
      const genericExtensions = rightChildren.filter((child) => isGenericFormalExtension(child, predicate.id));
      const baExtensions = rightChildren.filter((child) => isBaPostverbalExtension(child, predicate.id));
      const postverbalObjects = rightChildren.filter((child) => child.relation === "obj" || child.relation === "iobj");
      const postverbalMarkers = rightChildren.filter((child) =>
        relationBase(child.relation) === "mark" && (child.upos === "VERB" || child.upos === "ADP"),
      );
      const aspectChildren = rightChildren.filter((child) => ASPECT_FORMS.has(child.form));

      if (genericExtensions.length > 0) verbBaWithGenericExtensionCount += 1;
      if (baExtensions.length > 0) verbBaWithAnyPostverbalExtensionCount += 1;
      if (postverbalObjects.length > 0) verbBaWithPostverbalObjectCount += 1;
      if (postverbalMarkers.length > 0) verbBaWithPostverbalMarkerCount += 1;
      if (aspectChildren.length > 0) verbBaWithAspectCount += 1;

      for (const child of baExtensions) {
        increment(baExtensionRelationCounts, `${child.relation}\t${child.upos}`);
        increment(baExtensionFormCounts, `${child.form}\t${child.upos}\t${child.relation}`);
      }

      const shape = [
        genericExtensions.length > 0 ? "generic-extension" : null,
        postverbalObjects.length > 0 ? "secondary-object" : null,
        postverbalMarkers.length > 0 ? "predicate-marker" : null,
        aspectChildren.length > 0 ? "aspect" : null,
      ].filter((value): value is string => value !== null).join("+") || "no-recognized-extension";
      increment(baShapeCounts, shape);

      if (baExtensions.length === 0 && uncoveredVerbBaOccurrences.length < 40) {
        uncoveredVerbBaOccurrences.push({
          predicate: predicate.form,
          relation: predicate.relation,
          sentence: surface,
          rightChildren: rightChildren.map((child) => ({
            form: child.form,
            upos: child.upos,
            relation: child.relation,
          })),
        });
      }
    }
  }
}

const aggregateObjectPlusExtensionKeys = new Set(
  [...objectKeys].filter((key) => genericExtensionKeys.has(key)),
);

const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
const packagedVerbProfiles = SYNTAX_PROFILES.filter((profile) => profile.upos === "VERB");
const oldCanonicalProfiles = packagedVerbProfiles.filter((profile) =>
  profile.valencyFrames.includes("transitive") || profile.valencyFrames.includes("ambitransitive"),
);
const baCapabilityProfiles = packagedVerbProfiles.filter((profile) =>
  profile.occurrenceCapabilities?.includes("ba-obl-patient-case-same-occurrence") ?? false,
);
const oldIds = new Set(oldCanonicalProfiles.map((profile) => profile.id));
const productiveHeadProfiles = [...oldCanonicalProfiles];
for (const profile of baCapabilityProfiles) {
  if (!oldIds.has(profile.id)) productiveHeadProfiles.push(profile);
}

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

function union(...sets: readonly ReadonlySet<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

function verbBaRecall(keys: ReadonlySet<string>): { occurrence: number; lexemeUpos: number } {
  return {
    occurrence: verbBaOccurrenceKeys.filter((key) => keys.has(key)).length / verbBaOccurrenceKeys.length,
    lexemeUpos: [...verbBaKeys].filter((key) => keys.has(key)).length / verbBaKeys.size,
  };
}

const sameOccurrenceHybrid = union(verbBaKeys, objectPlusGenericExtensionKeys);
const aggregateHybrid = union(verbBaKeys, aggregateObjectPlusExtensionKeys);

const result = {
  auditVersion: "ba-structural-licensing-v2",
  reviewedBoundary: {
    allBaOccurrences: allBaOccurrenceCount,
    allBaLexemeUpos: allBaKeys.size,
    verbBaOccurrences: verbBaOccurrenceCount,
    verbBaLexemeUpos: verbBaKeys.size,
    nonVerbBaOccurrences,
  },
  observedBaPredicateShape: {
    withGenericFormalPostverbalExtension: verbBaWithGenericExtensionCount,
    withAnyRecognizedPostverbalExtension: verbBaWithAnyPostverbalExtensionCount,
    withPostverbalObjectOrIobj: verbBaWithPostverbalObjectCount,
    withPredicateMarker: verbBaWithPostverbalMarkerCount,
    withAspectForm: verbBaWithAspectCount,
    genericFormalExtensionRate: verbBaWithGenericExtensionCount / verbBaOccurrenceCount,
    anyRecognizedExtensionRate: verbBaWithAnyPostverbalExtensionCount / verbBaOccurrenceCount,
    shapeCounts: Object.fromEntries(top(baShapeCounts, 20)),
    topExtensionRelations: top(baExtensionRelationCounts, 30),
    topExtensionForms: top(baExtensionFormCounts, 40),
    uncoveredExamples: uncoveredVerbBaOccurrences,
  },
  lexicalFrontiers: {
    currentOldCanonical: summarizeProfiles(oldCanonicalProfiles),
    currentAttestedBaCapability: summarizeProfiles(baCapabilityProfiles),
    proposedPatientTakingUnionForCompletedBa: summarizeProfiles(productiveHeadProfiles),
    directObjectObservedRaw: {
      sourceLexemeUposKeys: objectKeys.size,
      packaged: summarizeProfiles(profilesForSourceKeys(objectKeys)),
      baRecall: verbBaRecall(objectKeys),
    },
    sameOccurrenceObjectPlusGenericExtension: {
      sourceLexemeUposKeys: objectPlusGenericExtensionKeys.size,
      packaged: summarizeProfiles(profilesForSourceKeys(objectPlusGenericExtensionKeys)),
      baRecall: verbBaRecall(objectPlusGenericExtensionKeys),
    },
    hybridAttestedBaOrSameOccurrenceObjectPlusExtension: {
      sourceLexemeUposKeys: sameOccurrenceHybrid.size,
      packaged: summarizeProfiles(profilesForSourceKeys(sameOccurrenceHybrid)),
      baRecall: verbBaRecall(sameOccurrenceHybrid),
    },
    aggregateObjectPlusExtension: {
      sourceLexemeUposKeys: aggregateObjectPlusExtensionKeys.size,
      packaged: summarizeProfiles(profilesForSourceKeys(aggregateObjectPlusExtensionKeys)),
      baRecall: verbBaRecall(aggregateObjectPlusExtensionKeys),
    },
    hybridAttestedBaOrAggregateObjectPlusExtension: {
      sourceLexemeUposKeys: aggregateHybrid.size,
      packaged: summarizeProfiles(profilesForSourceKeys(aggregateHybrid)),
      baRecall: verbBaRecall(aggregateHybrid),
    },
  },
};

console.log(JSON.stringify(result, null, 2));
