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

const summary = {
  auditVersion: "ba-occurrence-evidence-v1",
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
};

const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: BA_OCCURRENCE_EVIDENCE_CONTRACT,
  oblPatientPredicateTokenCount: 196,
  oblPatientLexemeUposCount: 165,
  baMarkedPatientPredicateTokenCount: 193,
  baMarkedPatientLexemeUposCount: 162,
  markerCounts: {
    把: 61,
    將: 132,
  },
} as const;

const renderedSummary = JSON.stringify(summary, null, 2);
console.log(renderedSummary);

if (process.argv.includes("--verify")) {
  const failures: string[] = [];
  if (summary.sourceCommit !== EXPECTED_PINNED_BOUNDARY.sourceCommit) {
    failures.push(`sourceCommit=${summary.sourceCommit}`);
  }
  if (summary.evidenceContract !== EXPECTED_PINNED_BOUNDARY.evidenceContract) {
    failures.push(`evidenceContract=${summary.evidenceContract}`);
  }
  if (summary.oblPatientPredicateTokenCount
    !== EXPECTED_PINNED_BOUNDARY.oblPatientPredicateTokenCount) {
    failures.push(`oblPatientPredicateTokenCount=${summary.oblPatientPredicateTokenCount}`);
  }
  if (summary.oblPatientLexemeUposCount
    !== EXPECTED_PINNED_BOUNDARY.oblPatientLexemeUposCount) {
    failures.push(`oblPatientLexemeUposCount=${summary.oblPatientLexemeUposCount}`);
  }
  if (summary.baMarkedPatientPredicateTokenCount
    !== EXPECTED_PINNED_BOUNDARY.baMarkedPatientPredicateTokenCount) {
    failures.push(`baMarkedPatientPredicateTokenCount=${summary.baMarkedPatientPredicateTokenCount}`);
  }
  if (summary.baMarkedPatientLexemeUposCount
    !== EXPECTED_PINNED_BOUNDARY.baMarkedPatientLexemeUposCount) {
    failures.push(`baMarkedPatientLexemeUposCount=${summary.baMarkedPatientLexemeUposCount}`);
  }
  if ((evidence.markerCounts.get("把") ?? 0) !== EXPECTED_PINNED_BOUNDARY.markerCounts.把) {
    failures.push(`markerCounts.把=${evidence.markerCounts.get("把") ?? 0}`);
  }
  if ((evidence.markerCounts.get("將") ?? 0) !== EXPECTED_PINNED_BOUNDARY.markerCounts.將) {
    failures.push(`markerCounts.將=${evidence.markerCounts.get("將") ?? 0}`);
  }
  if (evidence.markerCounts.size !== 2) {
    failures.push(`markerCounts.size=${evidence.markerCounts.size}`);
  }
  if (failures.length > 0) {
    throw new Error(
      `BA occurrence audit drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${renderedSummary}`,
    );
  }
}
