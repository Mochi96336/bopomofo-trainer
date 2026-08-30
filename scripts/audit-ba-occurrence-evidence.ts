import {
  BA_OCCURRENCE_EVIDENCE_CONTRACT,
  loadPinnedBaOccurrenceEvidence,
} from "./ba-occurrence-source.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await loadPinnedBaOccurrenceEvidence();

console.log(JSON.stringify({
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: BA_OCCURRENCE_EVIDENCE_CONTRACT,
  oblPatientPredicateTokenCount: evidence.oblPatientPredicateTokenCount,
  oblPatientLexemeUposCount: evidence.oblPatientPredicateCounts.size,
  baMarkedPatientPredicateTokenCount: evidence.baMarkedPatientPredicateTokenCount,
  baMarkedPatientLexemeUposCount: evidence.baMarkedPatientPredicateCounts.size,
  markerCounts: Object.fromEntries([...evidence.markerCounts].sort(([left], [right]) =>
    left.localeCompare(right, "zh-Hant"))),
}));
