import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/** Dictionary-level host-word attestations are NOT sentence-level reading labels. */
export interface CompoundHostEvidence {
  readonly caseId: string;
  readonly entryId: string;
  readonly evidenceBoundary: string;
  readonly exampleHostLexeme: string | null;
}

export interface LexemeBoundarySeed {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly entryIds: readonly string[];
}

export interface CompoundHostProbe {
  readonly caseId: string;
  readonly targetReadingEntryId: string;
  readonly hostLexeme: string;
  readonly hostCatalogEntryIds: readonly string[];
  readonly hostProfileEntryIds: readonly string[];
  /** Presence of a profile is necessary, NOT proof of actual grammar reachability. */
  readonly readiness: "absent-from-catalog" | "catalog-only" | "profile-present";
  /** Counts *selected whole catalog entries*, never substring character matches. */
  readonly sampledAtomicHostOccurrences: number;
  /** Surface string happens to contain host, but no full host entry was selected. */
  readonly sampledSurfaceOnlySentences: number;
  /** Target single-character identity was selected separately, not within host. */
  readonly sampledIsolatedTargetSentences: number;
  readonly verdict: "no-contextual-reading-inference";
}

export interface LexemeBoundaryReadinessReport {
  readonly schemaVersion: "polyphonic-lexeme-boundary-readiness-v1";
  readonly sampledSeeds: number;
  readonly sourceCases: number;
  readonly purpose: "research-only; no generated sentence treated as a reading label";
  readonly cases: readonly CompoundHostProbe[];
}

/**
 * Inspect only *existing selected token identities*. In particular, the
 * surface string "遊說" can arise either from the single entry 遊說 or the
 * consecutive entries 遊 and 說. String.includes is never a license for
 * the selected 說/ㄕㄨㄟ4 reading.
 *
 * This report deliberately does not infer character alignment inside a
 * compound, propose a forbidden isolated reading, or alter the sampler.
 */
export function auditLexemeBoundaryReadiness(
  evidence: readonly CompoundHostEvidence[],
  catalog: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  sentences: readonly LexemeBoundarySeed[],
): LexemeBoundaryReadinessReport {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  if (byId.size !== catalog.length) throw new Error("duplicate catalog entry identities");
  const seenCases = new Set<string>();
  const relevant = evidence.filter((row) => row.evidenceBoundary === "attested-in-larger-lexeme");

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index]!;
    if (sentence.seedIndex !== index) throw new Error("noncanonical ordered seed record");
    if (sentence.text === null && sentence.entryIds.length !== 0) {
      throw new Error("failed seed cannot carry selected entries");
    }
    for (const id of sentence.entryIds) {
      if (!byId.has(id)) throw new Error("selected seed identity absent from catalog: " + id);
    }
  }

  const probes = relevant.map((row): CompoundHostProbe => {
    if (seenCases.has(row.caseId)) throw new Error("duplicate compound review case: " + row.caseId);
    seenCases.add(row.caseId);
    const target = byId.get(row.entryId);
    if (target === undefined) throw new Error("compound review target absent from catalog: " + row.entryId);
    const host = row.exampleHostLexeme;
    if (host === null || host.length === 0 || host === target.prompt.text
      || !host.includes(target.prompt.text)) {
      throw new Error("invalid larger-lexeme evidence boundary: " + row.caseId);
    }
    const hostEntries = catalog.filter((entry) => entry.prompt.text === host);
    const hostIds = hostEntries.map((entry) => entry.id).sort();
    const hostIdSet = new Set(hostIds);
    const profileIds = [...new Set(
      profiles.filter((profile) => hostIdSet.has(profile.entryId)).map((profile) => profile.entryId),
    )].sort();
    let sampledAtomicHostOccurrences = 0;
    let sampledSurfaceOnlySentences = 0;
    let sampledIsolatedTargetSentences = 0;
    for (const sentence of sentences) {
      const selectedAtomicCount = sentence.entryIds.filter((id) => hostIdSet.has(id)).length;
      sampledAtomicHostOccurrences += selectedAtomicCount;
      if (selectedAtomicCount === 0 && sentence.text?.includes(host)) sampledSurfaceOnlySentences += 1;
      if (selectedAtomicCount === 0 && sentence.entryIds.includes(row.entryId)) {
        sampledIsolatedTargetSentences += 1;
      }
    }
    return {
      caseId: row.caseId,
      targetReadingEntryId: row.entryId,
      hostLexeme: host,
      hostCatalogEntryIds: hostIds,
      hostProfileEntryIds: profileIds,
      readiness: hostIds.length === 0
        ? "absent-from-catalog"
        : profileIds.length === 0 ? "catalog-only" : "profile-present",
      sampledAtomicHostOccurrences,
      sampledSurfaceOnlySentences,
      sampledIsolatedTargetSentences,
      verdict: "no-contextual-reading-inference",
    };
  });

  return {
    schemaVersion: "polyphonic-lexeme-boundary-readiness-v1",
    sampledSeeds: sentences.length,
    sourceCases: probes.length,
    purpose: "research-only; no generated sentence treated as a reading label",
    cases: probes,
  };
}
