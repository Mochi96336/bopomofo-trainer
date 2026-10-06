import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import { auditPinnedComparativeSourceEvidence } from "./comparative-source-evidence.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import { lexemeUposKey } from "./ud-occurrence-source.js";

const PROFILES_URL = new URL(
  "../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);

function sorted(values: Iterable<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

const [resolvedSource, provenanceSource, profilesSource, evidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(PROFILES_URL, "utf8"),
  auditPinnedComparativeSourceEvidence(),
]);

const provenanceRecords = parseCsv(provenanceSource).records;
const provenance = createProvenanceRegistry(provenanceRecords);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}

const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const profilesArtifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const candidates = profilesArtifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) throw new Error(`unknown active catalog entry: ${profile.entryId}`);
  return {
    sourceKey: lexemeUposKey(text, profile.upos),
    entryId: profile.entryId,
  };
});

const allSourceKeys = new Set(evidence.comparativePredicateCounts.keys());
const verbalSourceKeys = new Set(
  [...allSourceKeys].filter((key) => key.endsWith("\u0000VERB")),
);
const allIdentity = classifyRuntimeSourceIdentityMatches(candidates, allSourceKeys);
const verbalIdentity = classifyRuntimeSourceIdentityMatches(candidates, verbalSourceKeys);

const verbalProfiles = profilesArtifact.profiles.flatMap((profile, index) => {
  const candidate = candidates[index];
  if (candidate === undefined || !verbalIdentity.matchedSourceKeys.has(candidate.sourceKey)) return [];
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) return [];
  return [{
    sourceKey: candidate.sourceKey,
    profileId: profile.id,
    entryId: profile.entryId,
    text,
    upos: profile.upos,
    functions: profile.functions,
    valencyFrames: profile.valencyFrames,
    activatable: verbalIdentity.activatableSourceKeys.has(candidate.sourceKey),
    ambiguous: verbalIdentity.ambiguousSourceKeys.has(candidate.sourceKey),
  }];
});

const verbalTokenCount = [...evidence.comparativePredicateCounts]
  .filter(([key]) => verbalSourceKeys.has(key))
  .reduce((sum, [, count]) => sum + count, 0);

console.log(JSON.stringify({
  evidenceContract: evidence.contract,
  sourcePredicateTokenCount: evidence.governingPredicateTokenCount,
  sourcePredicateIdentityCount: allSourceKeys.size,
  matchedPredicateIdentityCount: allIdentity.matchedSourceKeys.size,
  ambiguousPredicateIdentityCount: allIdentity.ambiguousSourceKeys.size,
  activatablePredicateIdentityCount: allIdentity.activatableSourceKeys.size,
  verbalSourceTokenCount: verbalTokenCount,
  verbalSourceKeys: sorted(verbalSourceKeys),
  verbalMatchedSourceKeys: sorted(verbalIdentity.matchedSourceKeys),
  verbalAmbiguousSourceKeys: sorted(verbalIdentity.ambiguousSourceKeys),
  verbalActivatableSourceKeys: sorted(verbalIdentity.activatableSourceKeys),
  verbalUnmatchedSourceKeys: sorted(
    [...verbalSourceKeys].filter((key) => !verbalIdentity.matchedSourceKeys.has(key)),
  ),
  verbalProfiles,
}, null, 2));
