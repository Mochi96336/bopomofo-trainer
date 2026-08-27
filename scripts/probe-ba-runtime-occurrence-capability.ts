import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import { loadPinnedBaOccurrenceEvidence } from "./ba-occurrence-source.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import { lexemeUposKey } from "./ud-occurrence-source.js";

const PROFILES_URL = new URL(
  "../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);

const [resolvedSource, provenanceSource, profilesSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(PROFILES_URL, "utf8"),
  loadPinnedBaOccurrenceEvidence(),
]);

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}
const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}

const profilesArtifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const identityCandidates = profilesArtifact.profiles.map((profile) => {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) {
    throw new Error(`active runtime profile references unknown catalog entry: ${profile.entryId}`);
  }
  return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
});
const sourceKeys = new Set(sourceEvidence.baMarkedPatientPredicateCounts.keys());
const identity = classifyRuntimeSourceIdentityMatches(identityCandidates, sourceKeys);

const profileIds = new Set<string>();
const entryIds = new Set<string>();
const aggregateMatchedSourceKeys = new Set<string>();
for (const [index, profile] of profilesArtifact.profiles.entries()) {
  const sourceKey = identityCandidates[index]?.sourceKey;
  if (sourceKey === undefined) throw new Error(`missing BA identity candidate for ${profile.id}`);
  if (!profile.valencyFrames.includes("adpositional-complement")) continue;
  if (sourceKeys.has(sourceKey)) aggregateMatchedSourceKeys.add(sourceKey);
  if (!identity.activatableSourceKeys.has(sourceKey)) continue;
  profileIds.add(profile.id);
  entryIds.add(profile.entryId);
}

const unmatchedSourceKeys = [...sourceKeys]
  .filter((key) => !identity.matchedSourceKeys.has(key))
  .sort();
const ambiguousSourceKeys = [...identity.ambiguousSourceKeys].sort();
const activatableWithoutAggregate = [...identity.activatableSourceKeys]
  .filter((key) => !aggregateMatchedSourceKeys.has(key))
  .sort();

console.log(`BA_RUNTIME_JOIN=${JSON.stringify({
  sourceTokenCount: sourceEvidence.baMarkedPatientPredicateTokenCount,
  sourceLexemeUposCount: sourceKeys.size,
  matchedLexemeUposCount: identity.matchedSourceKeys.size,
  ambiguousMatchedLexemeUposCount: identity.ambiguousSourceKeys.size,
  activatableLexemeUposCount: identity.activatableSourceKeys.size,
  aggregateMatchedLexemeUposCount: aggregateMatchedSourceKeys.size,
  activatedProfileCount: profileIds.size,
  activatedEntryCount: entryIds.size,
  unmatchedSourceKeys,
  ambiguousSourceKeys,
  activatableWithoutAggregate,
  profileIds: [...profileIds].sort(),
})}`);
