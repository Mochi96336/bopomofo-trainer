import {
  LONG_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  SHORT_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  loadPinnedPassiveOccurrenceEvidence,
} from "./passive-occurrence-source.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const PINNED_PASSIVE_OCCURRENCE_BOUNDARY = {
  shortPassivePredicateTokenCount: 412,
  shortPassiveLexemeUposCount: 264,
  shortPassiveWithSubjectTokenCount: 266,
  longPassivePredicateTokenCount: 0,
  longPassiveLexemeUposCount: 0,
  longPassiveWithSubjectTokenCount: 0,
  passivePredicateTokenCount: 412,
  passiveLexemeUposCount: 264,
} as const;

const evidence = await loadPinnedPassiveOccurrenceEvidence();
const summary = {
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  shortPassiveEvidenceContract: SHORT_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  longPassiveEvidenceContract: LONG_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT,
  shortPassivePredicateTokenCount: evidence.shortPassivePredicateTokenCount,
  shortPassiveLexemeUposCount: evidence.shortPassivePredicateCounts.size,
  shortPassiveWithSubjectTokenCount: evidence.shortPassiveWithSubjectTokenCount,
  longPassivePredicateTokenCount: evidence.longPassivePredicateTokenCount,
  longPassiveLexemeUposCount: evidence.longPassivePredicateCounts.size,
  longPassiveWithSubjectTokenCount: evidence.longPassiveWithSubjectTokenCount,
  passivePredicateTokenCount: evidence.passivePredicateTokenCount,
  passiveLexemeUposCount: evidence.passivePredicateCounts.size,
};

if (!process.argv.includes("--measure")) {
  for (const [key, expected] of Object.entries(PINNED_PASSIVE_OCCURRENCE_BOUNDARY)) {
    const actual = summary[key as keyof typeof PINNED_PASSIVE_OCCURRENCE_BOUNDARY];
    if (actual !== expected) {
      throw new Error(
        `passive occurrence boundary drift for ${key}: expected ${expected}, received ${actual}`,
      );
    }
  }
}

console.log(JSON.stringify(summary));
