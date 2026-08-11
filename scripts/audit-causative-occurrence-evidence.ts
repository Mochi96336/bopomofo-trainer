import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import { parseCsv } from "../src/catalog/csv.js";
import { createProvenanceRegistry } from "../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import {
  CAUSATIVE_REVIEWED_FEATURE,
  UD_GSD_SOURCE_COMMIT,
  lexemeUposKey,
  loadPinnedCausativeOccurrenceEvidence,
} from "./causative-occurrence-source.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

function sortedTexts(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

const [resolvedSource, provenanceSource, profilesSource, sourceEvidence] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/provenance.csv", import.meta.url), "utf8"),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  loadPinnedCausativeOccurrenceEvidence(),
]);

const provenance = createProvenanceRegistry(parseCsv(provenanceSource).records);
if (provenance.errors.length > 0) {
  throw new Error(provenance.errors.map((error) => error.message).join("\n"));
}
const catalog = compileCatalog(resolvedSource.records, provenance.ids);
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const artifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;

const currentAggregateEntryIds = new Set<string>();
const currentAggregateProfileIds = new Set<string>();
const sameTokenCcompEntryIds = new Set<string>();
const sameTokenCcompProfileIds = new Set<string>();
const sameTokenOwnSubjectEntryIds = new Set<string>();
const sameTokenOwnSubjectProfileIds = new Set<string>();
const aggregateOnlyTexts = new Set<string>();

for (const profile of artifact.profiles) {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) throw new Error(`profile references unknown entry ${profile.entryId}`);
  const morphology = profile.dependencyEvidence.morphologicalFeatureCounts;
  const hasVoiceCau = (morphology?.[CAUSATIVE_REVIEWED_FEATURE] ?? 0) > 0;
  const hasAggregateCcomp = profile.valencyFrames.includes("clausal-complement");
  if (!hasVoiceCau || !hasAggregateCcomp) continue;

  currentAggregateProfileIds.add(profile.id);
  currentAggregateEntryIds.add(profile.entryId);
  const key = lexemeUposKey(text, profile.upos);
  if (sourceEvidence.sameTokenCcompCounts.has(key)) {
    sameTokenCcompProfileIds.add(profile.id);
    sameTokenCcompEntryIds.add(profile.entryId);
  } else {
    aggregateOnlyTexts.add(text);
  }
  if (sourceEvidence.sameTokenCcompOwnSubjectCounts.has(key)) {
    sameTokenOwnSubjectProfileIds.add(profile.id);
    sameTokenOwnSubjectEntryIds.add(profile.entryId);
  }
}

const summary = {
  auditVersion: "causative-occurrence-evidence-v2",
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedFeature: CAUSATIVE_REVIEWED_FEATURE,
  source: {
    voiceCauTokenCount: sourceEvidence.voiceCauTokenCount,
    voiceCauLexemeUposCount: sourceEvidence.voiceCauCounts.size,
    sameTokenCcompTokenCount: sourceEvidence.sameTokenCcompTokenCount,
    sameTokenCcompLexemeUposCount: sourceEvidence.sameTokenCcompCounts.size,
    sameTokenCcompOwnSubjectTokenCount: sourceEvidence.sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectLexemeUposCount: sourceEvidence.sameTokenCcompOwnSubjectCounts.size,
  },
  currentAggregateConsumer: {
    profileCount: currentAggregateProfileIds.size,
    entryCount: currentAggregateEntryIds.size,
  },
  supportedBySameTokenCcomp: {
    profileCount: sameTokenCcompProfileIds.size,
    entryCount: sameTokenCcompEntryIds.size,
  },
  supportedBySameTokenCcompOwnSubject: {
    profileCount: sameTokenOwnSubjectProfileIds.size,
    entryCount: sameTokenOwnSubjectEntryIds.size,
  },
  aggregateOnly: {
    profileCount: currentAggregateProfileIds.size - sameTokenCcompProfileIds.size,
    entryCount: currentAggregateEntryIds.size - sameTokenCcompEntryIds.size,
    texts: sortedTexts(aggregateOnlyTexts),
  },
};

const EXPECTED_PINNED_SUMMARY = {
  auditVersion: "causative-occurrence-evidence-v2",
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  reviewedFeature: CAUSATIVE_REVIEWED_FEATURE,
  source: {
    voiceCauTokenCount: 493,
    voiceCauLexemeUposCount: 134,
    sameTokenCcompTokenCount: 480,
    sameTokenCcompLexemeUposCount: 131,
    sameTokenCcompOwnSubjectTokenCount: 463,
    sameTokenCcompOwnSubjectLexemeUposCount: 130,
  },
  currentAggregateConsumer: {
    profileCount: 122,
    entryCount: 122,
  },
  supportedBySameTokenCcomp: {
    profileCount: 121,
    entryCount: 121,
  },
  supportedBySameTokenCcompOwnSubject: {
    profileCount: 120,
    entryCount: 120,
  },
  aggregateOnly: {
    profileCount: 1,
    entryCount: 1,
    texts: ["阻止"],
  },
} as const;

const renderedSummary = JSON.stringify(summary, null, 2);
console.log(renderedSummary);

if (process.argv.includes("--verify")) {
  const observed = JSON.stringify(summary);
  const expected = JSON.stringify(EXPECTED_PINNED_SUMMARY);
  if (observed !== expected) {
    throw new Error(
      `causative occurrence audit drifted from the pinned reviewed result\nexpected: ${JSON.stringify(EXPECTED_PINNED_SUMMARY, null, 2)}\nobserved: ${renderedSummary}`,
    );
  }
}
