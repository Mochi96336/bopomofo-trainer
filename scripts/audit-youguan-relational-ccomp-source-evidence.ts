import {
  auditPinnedYouguanRelationalCcompSourceEvidence,
} from "./youguan-relational-ccomp-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedYouguanRelationalCcompSourceEvidence();

const summary = {
  auditVersion: "youguan-relational-ccomp-source-evidence-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  targetOccurrenceCount: evidence.targetOccurrenceCount,
  targetRelationCounts: evidence.targetRelationCounts,
  targetRootCount: evidence.targetRootCount,
  targetNonRootCount: evidence.targetNonRootCount,
  targetWithDirectCcompCount: evidence.targetWithDirectCcompCount,
  targetWithoutDirectCcompCount: evidence.targetWithoutDirectCcompCount,
  targetWithMatrixSubjectCount: evidence.targetWithMatrixSubjectCount,
  targetWithoutMatrixSubjectCount: evidence.targetWithoutMatrixSubjectCount,
  reviewedSignatureCount: evidence.reviewedSignatureCount,
  reviewedCaseFormCounts: evidence.reviewedCaseFormCounts,
  reviewedCcompHeadUposCounts: evidence.reviewedCcompHeadUposCounts,
  reviewedWithMatrixSubjectCount: evidence.reviewedWithMatrixSubjectCount,
  reviewedWithoutMatrixSubjectCount: evidence.reviewedWithoutMatrixSubjectCount,
  reviewedWithEmbeddedSubjectCount: evidence.reviewedWithEmbeddedSubjectCount,
  reviewedWithoutEmbeddedSubjectCount: evidence.reviewedWithoutEmbeddedSubjectCount,
  reviewedOccurrenceDigest: evidence.reviewedOccurrenceDigest,
};

console.log(JSON.stringify({ ...summary, reviewedOccurrences: evidence.reviewedOccurrences }, null, 2));

const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "same-root-youguan-case-ccomp-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  targetOccurrenceCount: 14,
  targetRelationCounts: {
    amod: 8,
    ccomp: 1,
    parataxis: 1,
    root: 4,
  },
  targetRootCount: 4,
  targetNonRootCount: 10,
  targetWithDirectCcompCount: 3,
  targetWithoutDirectCcompCount: 11,
  targetWithMatrixSubjectCount: 5,
  targetWithoutMatrixSubjectCount: 9,
  reviewedSignatureCount: 3,
  reviewedCaseFormCounts: {
    "和": 1,
    "與": 2,
  },
  reviewedCcompHeadUposCounts: {
    ADJ: 2,
    VERB: 1,
  },
  reviewedWithMatrixSubjectCount: 2,
  reviewedWithoutMatrixSubjectCount: 1,
  reviewedWithEmbeddedSubjectCount: 3,
  reviewedWithoutEmbeddedSubjectCount: 0,
  reviewedOccurrenceDigest:
    "5012d1d6fa764e8ae03549d81336376a48eb149a061c08b317ebae0e1bb28a56",
} as const;

if (process.argv.includes("--verify")) {
  const failures: string[] = [];
  for (const [key, expected] of Object.entries(EXPECTED_PINNED_BOUNDARY)) {
    const observed = summary[key as keyof typeof summary];
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      failures.push(`${key}=${JSON.stringify(observed)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `有關 relational-ccomp evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
