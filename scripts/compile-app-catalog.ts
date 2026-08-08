import { mkdir, readFile, writeFile } from "node:fs/promises";
import { encodeCatalogEntries, encodeSyntaxProfiles } from "../src/app/catalog-codec.js";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import { applyCommonnessProjection } from "../src/commonness/catalog-projection.js";
import {
  projectNaerActiveCatalogRows,
  type NaerActiveCatalogRowsFile,
} from "../src/commonness/naer-general-frequency.js";
import { commonnessTierThresholds } from "../src/commonness/tiers.js";
import {
  applyCatalogSyntaxLegalityArtifact,
  type CatalogSyntaxLegalityArtifact,
} from "../src/syntax/catalog-legality.js";
import { FORMAL_GRAMMAR_VERSION } from "../src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { buildSyntaxRuleIndex } from "../src/syntax/rule-index.js";
import {
  loadActiveCatalogSyntaxProfilesArtifact,
  type ActiveCatalogSyntaxProfilesArtifact,
} from "../src/syntax/runtime-profiles.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

interface FormalSyntaxRuntimeLock {
  readonly schemaVersion: "formal-syntax-runtime-lock-v1";
  readonly grammarVersion: string;
  readonly sourceRuleIndexDigest: string;
  readonly grammarRulesDigest: string;
}

const [
  resolvedSource,
  provenanceSource,
  commonnessSource,
  syntaxLegalitySource,
  syntaxProfilesSource,
  syntaxRuntimeLockSource,
] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/commonness/naer-1141208-active-catalog-rows.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-legality.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-lock.json", import.meta.url), "utf8"),
]);

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}

const result = compileCatalog(resolvedSource.records, provenance.ids);
if (result.errors.length > 0) {
  throw new Error(result.errors.map((error) => `row ${error.rowNumber}: ${error.message}`).join("\n"));
}

const commonnessRows = JSON.parse(commonnessSource) as NaerActiveCatalogRowsFile;
const commonness = projectNaerActiveCatalogRows(commonnessRows, result.entries);
const appliedCommonness = applyCommonnessProjection(result.entries, commonness.projection);
if (appliedCommonness.unusedProjectionEntryIds.length > 0) {
  throw new Error(
    `commonness projection contains unknown catalog entries: ${appliedCommonness.unusedProjectionEntryIds.join(", ")}`,
  );
}

// The committed legality artifact remains a validated lineage record for the
// profile generation workspace. Current product legality is recomputed below
// from the shipped compact profiles plus the executable grammar.
const sourceSyntaxArtifact = JSON.parse(syntaxLegalitySource) as CatalogSyntaxLegalityArtifact;
applyCatalogSyntaxLegalityArtifact(result.entries, sourceSyntaxArtifact);
const syntaxProfilesArtifact = JSON.parse(syntaxProfilesSource) as ActiveCatalogSyntaxProfilesArtifact;
const sourceSyntaxProfiles = loadActiveCatalogSyntaxProfilesArtifact(
  result.entries,
  syntaxProfilesArtifact,
);
if (syntaxProfilesArtifact.sourceRuleIndexDigest !== sourceSyntaxArtifact.sourceRuleIndexDigest) {
  throw new Error("syntax profile and legality artifacts disagree about their source rule index");
}

const currentRuleIndex = buildSyntaxRuleIndex({
  lexemes: result.entries.map((entry, index) => ({
    id: entry.id,
    text: entry.prompt.text,
    generalRank: index + 1,
  })),
  profiles: sourceSyntaxProfiles,
  rules: FORMAL_SYNTAX_RULES,
});
const currentLegalEntryIds = new Set(
  currentRuleIndex.entries
    .filter((entry) => entry.status === "indexed")
    .map((entry) => entry.entryId),
);
const currentExclusions = currentRuleIndex.entries.filter((entry) => entry.status !== "indexed");
if (currentLegalEntryIds.size === 0) {
  throw new Error("current formal syntax grammar excludes the complete app catalog");
}
const syntaxProfiles = sourceSyntaxProfiles.filter((profile) => currentLegalEntryIds.has(profile.entryId));
const profiledCurrentEntries = new Set(syntaxProfiles.map((profile) => profile.entryId));
if (profiledCurrentEntries.size !== currentLegalEntryIds.size
  || [...currentLegalEntryIds].some((entryId) => !profiledCurrentEntries.has(entryId))) {
  throw new Error("current formal syntax legality contains an entry without a packaged runtime profile");
}

const runtimeLock = JSON.parse(syntaxRuntimeLockSource) as FormalSyntaxRuntimeLock;
if (runtimeLock.schemaVersion !== "formal-syntax-runtime-lock-v1"
  || runtimeLock.grammarVersion !== FORMAL_GRAMMAR_VERSION
  || runtimeLock.sourceRuleIndexDigest !== sourceSyntaxArtifact.sourceRuleIndexDigest
  || runtimeLock.grammarRulesDigest !== currentRuleIndex.grammarRulesDigest) {
  throw new Error(
    `formal syntax runtime lock is stale: expected grammarRulesDigest=${currentRuleIndex.grammarRulesDigest}, sourceRuleIndexDigest=${sourceSyntaxArtifact.sourceRuleIndexDigest}`,
  );
}

const syntaxLegalEntries = appliedCommonness.entries
  .filter((entry) => currentLegalEntryIds.has(entry.id));
const practiceTokens = new Set(
  syntaxLegalEntries.flatMap((entry) => entry.syllables.flatMap((syllable) => syllable.tokens)),
);
const missingTones = [1, 2, 3, 4, 5]
  .map((tone) => `tone:${tone}`)
  .filter((tokenId) => !practiceTokens.has(tokenId));
if (missingTones.length > 0) {
  throw new Error(`practice catalog is missing tones: ${missingTones.join(", ")}`);
}

const tierThresholds = commonnessTierThresholds(
  syntaxLegalEntries
    .map((entry) => entry.commonnessBase?.selectionWeight)
    .filter((weight): weight is number => weight !== undefined),
);

const outputUrl = new URL("../src/app/generated/", import.meta.url);
await mkdir(outputUrl, { recursive: true });
const packagedTexts = new Set(syntaxLegalEntries.map((entry) => entry.prompt.text));
const packagedChangedTexts = resolvedSource.report.changedTexts.filter((text) => packagedTexts.has(text));
const encodedProfiles = encodeSyntaxProfiles(syntaxProfiles, syntaxLegalEntries);
const moduleSource = [
  "// Generated by npm run app:catalog. Do not edit manually.",
  'import type { CommonnessTierThresholds } from "../../commonness/tiers.js";',
  'import type { CatalogEntry } from "../../core/model.js";',
  'import type { RuntimeSyntaxProfile } from "../../syntax/types.js";',
  "import {",
  "  decodeCatalogEntries,",
  "  decodeSyntaxProfiles,",
  "  type EncodedCatalogEntry,",
  "  type EncodedSyntaxProfile,",
  '} from "../catalog-codec.js";',
  "",
  `export const READING_RESOLUTION_DIGEST = ${JSON.stringify(resolvedSource.report.determinismDigest)};`,
  `export const READING_RESOLUTION_COUNTS = ${JSON.stringify(resolvedSource.report.counts)} as const;`,
  `export const READING_RESOLUTION_CHANGED_TEXTS = ${JSON.stringify(packagedChangedTexts)} as const;`,
  "",
  `export const COMMONNESS_PROJECTION_DIGEST = ${JSON.stringify(commonness.projection.determinismDigest)};`,
  `export const COMMONNESS_TIER_THRESHOLDS: CommonnessTierThresholds = ${JSON.stringify(tierThresholds)};`,
  `export const SYNTAX_EVIDENCE_DIGEST = ${JSON.stringify(sourceSyntaxArtifact.sourceEvidenceDigest)};`,
  `export const SYNTAX_PROFILE_PROJECTION_DIGEST = ${JSON.stringify(sourceSyntaxArtifact.sourceProfileProjectionDigest)};`,
  `export const SYNTAX_SOURCE_RULE_INDEX_DIGEST = ${JSON.stringify(sourceSyntaxArtifact.sourceRuleIndexDigest)};`,
  `export const SYNTAX_RULE_INDEX_DIGEST = ${JSON.stringify(currentRuleIndex.determinismDigest)};`,
  `export const SYNTAX_GRAMMAR_RULES_DIGEST = ${JSON.stringify(currentRuleIndex.grammarRulesDigest)};`,
  `export const SYNTAX_RUNTIME_PROFILES_DIGEST = ${JSON.stringify(syntaxProfilesArtifact.determinismDigest)};`,
  "",
  `const ENCODED_PRACTICE: readonly EncodedCatalogEntry[] = ${JSON.stringify(encodeCatalogEntries(syntaxLegalEntries))};`,
  "const ENCODED_EVALUATION: readonly EncodedCatalogEntry[] = [];",
  `const DEPENDENCY_RELATION_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.relationKeys)};`,
  `const SURFACE_POSITION_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.positionKeys)};`,
  `const ENCODED_SYNTAX_PROFILES: readonly EncodedSyntaxProfile[] = ${JSON.stringify(encodedProfiles.profiles)};`,
  "",
  "export const PRACTICE_CATALOG: readonly CatalogEntry[] = decodeCatalogEntries(ENCODED_PRACTICE);",
  "export const EVALUATION_CATALOG: readonly CatalogEntry[] = decodeCatalogEntries(ENCODED_EVALUATION);",
  "export const SYNTAX_PROFILES: readonly RuntimeSyntaxProfile[] = decodeSyntaxProfiles(",
  "  ENCODED_SYNTAX_PROFILES,",
  "  PRACTICE_CATALOG,",
  "  DEPENDENCY_RELATION_KEYS,",
  "  SURFACE_POSITION_KEYS,",
  ");",
  "",
].join("\n");

await writeFile(new URL("catalog.ts", outputUrl), moduleSource, "utf8");
console.log(
  `wrote ${syntaxLegalEntries.length} current syntax-legal practice entries with ${syntaxProfiles.length} runtime syntax profiles; excluded ${currentExclusions.length} entries under the executable grammar; resolved readings ${JSON.stringify(resolvedSource.report.counts)}; applied commonness to ${appliedCommonness.appliedEntryIds.length} entries; ${commonness.exclusions.length} identity exclusions; ${commonness.unmatchedCatalogEntryIds.length} catalog fallbacks`,
);
