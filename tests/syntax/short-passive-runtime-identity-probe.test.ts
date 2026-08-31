import { appendFile, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compileCatalog } from "../../src/catalog/compile-catalog.js";
import { parseCsv } from "../../src/catalog/csv.js";
import { createProvenanceRegistry } from "../../src/catalog/provenance.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../../src/syntax/runtime-profiles.js";
import { loadPinnedPassiveOccurrenceEvidence } from "../../scripts/passive-occurrence-source.js";
import { loadResolvedCatalogSource } from "../../scripts/load-resolved-catalog-source.js";
import { classifyRuntimeSourceIdentityMatches } from "../../scripts/runtime-source-identity.js";
import { lexemeUposKey } from "../../scripts/ud-occurrence-source.js";

const PROFILES_URL = new URL(
  "../../data/grammar/formal-syntax-active-catalog-profiles.json",
  import.meta.url,
);

describe("temporary short-passive runtime identity probe", () => {
  it("measures the identity-safe projection frontier", async () => {
    const [resolvedSource, provenanceSource, profilesSource, evidence] = await Promise.all([
      loadResolvedCatalogSource(),
      readFile(new URL("../../data/provenance.csv", import.meta.url), "utf8"),
      readFile(PROFILES_URL, "utf8"),
      loadPinnedPassiveOccurrenceEvidence(),
    ]);

    expect(evidence.shortPassivePredicateTokenCount).toBe(412);
    expect(evidence.shortPassivePredicateCounts.size).toBe(264);
    expect(evidence.shortPassiveWithSubjectTokenCount).toBe(266);
    expect(evidence.longPassivePredicateTokenCount).toBe(0);

    const provenanceRecords = parseCsv(provenanceSource).records;
    const provenance = createProvenanceRegistry(provenanceRecords);
    expect(provenance.errors).toEqual([]);
    const catalog = compileCatalog(resolvedSource.records, provenance.ids);
    expect(catalog.errors).toEqual([]);

    const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
    const profilesArtifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;
    const identityCandidates = profilesArtifact.profiles.map((profile) => {
      const text = textByEntryId.get(profile.entryId);
      if (text === undefined) throw new Error(`unknown catalog entry: ${profile.entryId}`);
      return { sourceKey: lexemeUposKey(text, profile.upos), entryId: profile.entryId };
    });
    const sourceKeys = new Set(evidence.shortPassivePredicateCounts.keys());
    const identity = classifyRuntimeSourceIdentityMatches(identityCandidates, sourceKeys);
    const unmatchedSourceKeys = [...sourceKeys]
      .filter((key) => !identity.matchedSourceKeys.has(key))
      .sort();
    const ambiguousSourceKeys = [...identity.ambiguousSourceKeys].sort();

    const activatedProfiles = profilesArtifact.profiles.filter((_, index) => {
      const key = identityCandidates[index]?.sourceKey;
      return key !== undefined && identity.activatableSourceKeys.has(key);
    });
    const activatedEntryIds = new Set(activatedProfiles.map((profile) => profile.entryId));
    const uposCounts = Object.fromEntries(
      [...new Set(activatedProfiles.map((profile) => profile.upos))]
        .sort()
        .map((upos) => [upos, activatedProfiles.filter((profile) => profile.upos === upos).length]),
    );
    const transitiveLikeProfileCount = activatedProfiles.filter((profile) =>
      profile.valencyFrames.includes("transitive") || profile.valencyFrames.includes("ambitransitive"),
    ).length;
    const adpositionalProfileCount = activatedProfiles.filter((profile) =>
      profile.valencyFrames.includes("adpositional-complement"),
    ).length;
    const summary = {
      sourceTokenCount: evidence.shortPassivePredicateTokenCount,
      sourceLexemeUposCount: sourceKeys.size,
      matchedLexemeUposCount: identity.matchedSourceKeys.size,
      ambiguousMatchedLexemeUposCount: identity.ambiguousSourceKeys.size,
      activatableLexemeUposCount: identity.activatableSourceKeys.size,
      unmatchedSourceKeyCount: unmatchedSourceKeys.length,
      activatedProfileCount: activatedProfiles.length,
      activatedEntryCount: activatedEntryIds.size,
      uposCounts,
      transitiveLikeProfileCount,
      adpositionalProfileCount,
      ambiguousSourceKeys,
    };
    const summaryJson = JSON.stringify(summary);

    console.log(`SHORT_PASSIVE_RUNTIME_IDENTITY=${summaryJson}`);
    console.log(`::notice title=SHORT_PASSIVE_RUNTIME_IDENTITY::${summaryJson}`);
    await writeFile("short-passive-runtime-identity.json", `${summaryJson}\n`, "utf8");
    const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummaryPath !== undefined) {
      await appendFile(
        stepSummaryPath,
        `\n### Short passive runtime identity probe\n\n\`\`\`json\n${summaryJson}\n\`\`\`\n`,
      );
    }

    expect(identity.activatableSourceKeys.size).toBeGreaterThan(0);
    expect(activatedProfiles.length).toBeGreaterThan(0);
  });
});
