import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import { auditPinnedLocativeSourceEvidence } from "./locative-source-evidence.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "./runtime-source-identity.js";
import { lexemeUposKey } from "./ud-occurrence-source.js";

const [resolvedSource, provenanceSource, profilesSource, evidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  auditPinnedLocativeSourceEvidence(),
]);

const sourceKeys = new Set(evidence.verbalLocativePredicateCounts.keys());
if (evidence.zaiVerbRootWithSubjectAndObjectTokenCount !== 12
  || sourceKeys.size !== 1
  || evidence.verbalLocativePredicateCounts.get(lexemeUposKey("在", "VERB")) !== 12) {
  throw new Error("reviewed verbal locative source frontier drifted");
}

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
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
  if (text === undefined) throw new Error(`unknown active catalog entry ${profile.entryId}`);
  return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
});
const identity = classifyRuntimeSourceIdentityMatches(candidates, sourceKeys);

const matchingProfiles = profilesArtifact.profiles
  .filter((profile, index) => {
    const candidate = candidates[index];
    return candidate !== undefined && identity.matchedSourceKeys.has(candidate.sourceKey);
  })
  .map((profile) => ({
    id: profile.id,
    entryId: profile.entryId,
    text: textByEntryId.get(profile.entryId) ?? null,
    upos: profile.upos,
    functions: profile.functions,
    valencyFrames: profile.valencyFrames,
  }))
  .sort((left, right) => left.id.localeCompare(right.id));

const activatableProfiles = profilesArtifact.profiles
  .filter((profile, index) => {
    const candidate = candidates[index];
    return candidate !== undefined && identity.activatableSourceKeys.has(candidate.sourceKey);
  })
  .map((profile) => profile.id)
  .sort();

const summary = {
  sourceTokenCount: evidence.zaiVerbRootWithSubjectAndObjectTokenCount,
  sourceKeys: [...sourceKeys].sort(),
  matchedSourceKeys: [...identity.matchedSourceKeys].sort(),
  ambiguousSourceKeys: [...identity.ambiguousSourceKeys].sort(),
  activatableSourceKeys: [...identity.activatableSourceKeys].sort(),
  matchingProfiles,
  activatableProfiles,
};

console.log(JSON.stringify(summary, null, 2));
