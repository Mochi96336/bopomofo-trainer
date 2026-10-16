import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildLexicalCompatibilityIndex, type LexicalCompatibilityArtifact } from "../src/compatibility/lexical-pairs.js";
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
import {
  applyRuntimeOccurrenceCapabilityProjections,
  type RuntimeOccurrenceCapabilityProjectionArtifact,
} from "../src/syntax/runtime-occurrence-capability-projection.js";
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
  occurrenceCapabilitiesSource,
  baOccurrenceCapabilitiesSource,
  shortPassiveOccurrenceCapabilitiesSource,
  preverbalAuxOccurrenceCapabilitiesSource,
  locativeOccurrenceCapabilitiesSource,
  comparativeOccurrenceCapabilitiesSource,
  youguanRelationalCcompOccurrenceCapabilitiesSource,
  syntaxRuntimeLockSource,
  lexicalCompatibilitySource,
  activeWordCsv,
] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/commonness/naer-1141208-active-catalog-rows.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-legality.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-ba-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-short-passive-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-preverbal-aux-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-locative-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-comparative-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-youguan-relational-ccomp-occurrence-capabilities.json", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-runtime-lock.json", import.meta.url), "utf8"),
  readFile(new URL("../data/compatibility/ud-gsd-active-surface-pairs.json", import.meta.url), "utf8"),
  readFile(new URL("../data/source/words.sample.csv", import.meta.url), "utf8"),
]);


const lexicalArtifact = JSON.parse(lexicalCompatibilitySource) as LexicalCompatibilityArtifact;
const lexicalSource = lexicalArtifact.source as {
  pinnedCommit?: string;
  files?: readonly { filename: string; checksumSha256: string }[];
};
const candidateSource = lexicalArtifact.candidateSource as {
  gitBlobSha?: string; canonicalChecksumSha256?: string;
};
const pinnedUdFiles = [
  ["zh_gsd-ud-train.conllu", "de36e605a4786edb00097165cfc0ee425ab668a2dfc1da7ce4652ba4d2585b1e"],
  ["zh_gsd-ud-dev.conllu", "09374c8361400861a536ae94a1d7710e1cdd72285c32b9764d94d2d956b4ae02"],
  ["zh_gsd-ud-test.conllu", "ff01a3d01d62b623756396085e78bdaeefb7c2b7935a890dde5b18e92712d54f"],
] as const;
const activeCsvChecksum = createHash("sha256").update(
  activeWordCsv.replaceAll("\r\n", "\n").replaceAll("\r", "\n"), "utf8",
).digest("hex");
if (lexicalSource.pinnedCommit !== "22f73e87f7ddc530bb131a6b7587971a03e1a712"
  || candidateSource.gitBlobSha !== "458a75728b0ff9fe95b5d30a6a8d3f2c1ecf7f54"
  || candidateSource.canonicalChecksumSha256 !== activeCsvChecksum
  || lexicalSource.files?.length !== pinnedUdFiles.length
  || pinnedUdFiles.some(([name, checksum], index) =>
    lexicalSource.files?.[index]?.filename !== name
      || lexicalSource.files?.[index]?.checksumSha256 !== checksum)
  || lexicalArtifact.minimumPairCount !== 4
  || lexicalArtifact.dependencyPairs.length !== 0) {
  throw new Error("pinned lexical compatibility source or active catalog basis has drifted");
}
// Compile-time SHA-256 canonical verification and strict pair validation.
// Only positive surface scores are packaged; no source sentences or Node crypto.
buildLexicalCompatibilityIndex(lexicalArtifact);

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
const baseSyntaxProfiles = loadActiveCatalogSyntaxProfilesArtifact(
  result.entries,
  syntaxProfilesArtifact,
);
const occurrenceCapabilitiesArtifact = JSON.parse(
  occurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const baOccurrenceCapabilitiesArtifact = JSON.parse(
  baOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const shortPassiveOccurrenceCapabilitiesArtifact = JSON.parse(
  shortPassiveOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const preverbalAuxOccurrenceCapabilitiesArtifact = JSON.parse(
  preverbalAuxOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const locativeOccurrenceCapabilitiesArtifact = JSON.parse(
  locativeOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const comparativeOccurrenceCapabilitiesArtifact = JSON.parse(
  comparativeOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const youguanRelationalCcompOccurrenceCapabilitiesArtifact = JSON.parse(
  youguanRelationalCcompOccurrenceCapabilitiesSource,
) as RuntimeOccurrenceCapabilityProjectionArtifact;
const sourceSyntaxProfiles = applyRuntimeOccurrenceCapabilityProjections(
  baseSyntaxProfiles,
  syntaxProfilesArtifact.determinismDigest,
  [
    occurrenceCapabilitiesArtifact,
    baOccurrenceCapabilitiesArtifact,
    shortPassiveOccurrenceCapabilitiesArtifact,
    preverbalAuxOccurrenceCapabilitiesArtifact,
    locativeOccurrenceCapabilitiesArtifact,
    comparativeOccurrenceCapabilitiesArtifact,
    youguanRelationalCcompOccurrenceCapabilitiesArtifact,
  ],
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
const lexicalPairs = lexicalArtifact.surfacePairs
  .filter((pair) => packagedTexts.has(pair.leftText) && packagedTexts.has(pair.rightText))
  .map((pair) => [pair.leftText, pair.rightText, pair.score] as const);
const moduleSource = [
  "// Generated by npm run app:catalog. Do not edit manually.",
  'import type { CommonnessTierThresholds } from "../../commonness/tiers.js";',
  'import type { CatalogEntry } from "../../core/model.js";',
  'import type { RuntimeSyntaxProfile } from "../../syntax/types.js";',
  'import type { LexicalCompatibilityIndex } from "../../compatibility/lexical-pairs.js";',
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
  `export const SYNTAX_RUNTIME_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(occurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_BA_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(baOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_SHORT_PASSIVE_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(shortPassiveOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_PREVERBAL_AUX_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(preverbalAuxOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_LOCATIVE_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(locativeOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_COMPARATIVE_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(comparativeOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  `export const SYNTAX_RUNTIME_YOUGUAN_RELATIONAL_CCOMP_OCCURRENCE_CAPABILITIES_DIGEST = ${JSON.stringify(youguanRelationalCcompOccurrenceCapabilitiesArtifact.determinismDigest)};`,
  "",
  `const ENCODED_PRACTICE: readonly EncodedCatalogEntry[] = ${JSON.stringify(encodeCatalogEntries(syntaxLegalEntries))};`,
  `const DEPENDENCY_RELATION_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.relationKeys)};`,
  `const SURFACE_POSITION_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.positionKeys)};`,
  `const MORPHOLOGICAL_FEATURE_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.morphologyKeys)};`,
  `const OCCURRENCE_CAPABILITY_KEYS: readonly string[] = ${JSON.stringify(encodedProfiles.occurrenceCapabilityKeys)};`,
  `const ENCODED_SYNTAX_PROFILES: readonly EncodedSyntaxProfile[] = ${JSON.stringify(encodedProfiles.profiles)};`,
  `const ENCODED_LEXICAL_PAIRS: readonly (readonly [string, string, number])[] = ${JSON.stringify(lexicalPairs)};`,
  `export const LEXICAL_COMPATIBILITY_DIGEST = ${JSON.stringify(lexicalArtifact.determinismDigest)};`,
  "",
  "export const LEXICAL_COMPATIBILITY: LexicalCompatibilityIndex = {",
  "  surfaceScoreByPair: new Map(ENCODED_LEXICAL_PAIRS.map(([left, right, score]) => [JSON.stringify([left, right]), score])),",
  "  dependencyScoreByPair: new Map(),",
  "};",
  "export const PRACTICE_CATALOG: readonly CatalogEntry[] = decodeCatalogEntries(ENCODED_PRACTICE);",
  "export const SYNTAX_PROFILES: readonly RuntimeSyntaxProfile[] = decodeSyntaxProfiles(",
  "  ENCODED_SYNTAX_PROFILES,",
  "  PRACTICE_CATALOG,",
  "  DEPENDENCY_RELATION_KEYS,",
  "  SURFACE_POSITION_KEYS,",
  "  MORPHOLOGICAL_FEATURE_KEYS,",
  "  OCCURRENCE_CAPABILITY_KEYS,",
  ");",
  "",
].join("\n");

await writeFile(new URL("catalog.ts", outputUrl), moduleSource, "utf8");
console.log(
  `wrote ${syntaxLegalEntries.length} current syntax-legal practice entries with ${syntaxProfiles.length} runtime syntax profiles and ${lexicalPairs.length} verified lexical surface pair scores; excluded ${currentExclusions.length} entries under the executable grammar; resolved readings ${JSON.stringify(resolvedSource.report.counts)}; applied commonness to ${appliedCommonness.appliedEntryIds.length} entries; ${commonness.exclusions.length} identity exclusions; ${commonness.unmatchedCatalogEntryIds.length} catalog fallbacks`,
);
