import {
  ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT,
  auditPinnedArgumentRealizationSourceEvidence,
} from "./argument-realization-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedArgumentRealizationSourceEvidence();

const summary = {
  auditVersion: "argument-realization-source-evidence-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  diagnosticThreshold: evidence.diagnosticThreshold,
  verbOccurrenceCount: evidence.verbOccurrenceCount,
  verbFormCount: evidence.verbFormCount,
  subjectAlternationObservedFormCount: evidence.subjectAlternationObservedFormCount,
  subjectAlternationReviewedFrontierFormCount:
    evidence.subjectAlternationReviewedFrontierFormCount,
  directObjectAlternationObservedFormCount: evidence.directObjectAlternationObservedFormCount,
  directObjectAlternationReviewedFrontierFormCount:
    evidence.directObjectAlternationReviewedFrontierFormCount,
  bothReviewedFrontiersFormCount: evidence.bothReviewedFrontiersFormCount,
  subjectReviewedFrontierOvertTokenCount: evidence.subjectReviewedFrontierOvertTokenCount,
  subjectReviewedFrontierAbsentTokenCount: evidence.subjectReviewedFrontierAbsentTokenCount,
  directObjectReviewedFrontierOvertTokenCount:
    evidence.directObjectReviewedFrontierOvertTokenCount,
  directObjectReviewedFrontierAbsentTokenCount:
    evidence.directObjectReviewedFrontierAbsentTokenCount,
};

const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: ARGUMENT_REALIZATION_SOURCE_EVIDENCE_CONTRACT,
  diagnosticThreshold: { minimumCountEachState: 2, minimumShareEachState: 0.10 },
  verbOccurrenceCount: 18_217,
  verbFormCount: 4_668,
  subjectAlternationObservedFormCount: 1_216,
  subjectAlternationReviewedFrontierFormCount: 532,
  directObjectAlternationObservedFormCount: 885,
  directObjectAlternationReviewedFrontierFormCount: 367,
  bothReviewedFrontiersFormCount: 302,
  subjectReviewedFrontierOvertTokenCount: 5_097,
  subjectReviewedFrontierAbsentTokenCount: 4_952,
  directObjectReviewedFrontierOvertTokenCount: 4_010,
  directObjectReviewedFrontierAbsentTokenCount: 3_253,
} as const;

const renderedSummary = JSON.stringify(summary, null, 2);
console.log(renderedSummary);

if (process.argv.includes("--verify")) {
  const failures: string[] = [];
  const expectEqual = (label: string, observed: unknown, expected: unknown): void => {
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      failures.push(`${label}=${JSON.stringify(observed)}`);
    }
  };

  for (const [key, expected] of Object.entries(EXPECTED_PINNED_BOUNDARY)) {
    expectEqual(key, summary[key as keyof typeof summary], expected);
  }

  if (failures.length > 0) {
    throw new Error(
      `argument realization source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${renderedSummary}`,
    );
  }
}
