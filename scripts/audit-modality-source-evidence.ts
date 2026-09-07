import { auditPinnedModalitySourceEvidence } from "./modality-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedModalitySourceEvidence();

const summary = {
  auditVersion: "modality-source-evidence-v2",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  preverbalAuxEvidenceContract: evidence.preverbalAuxEvidenceContract,
  auxTokenCount: evidence.auxTokenCount,
  auxFormCount: evidence.auxFormCount,
  relationCounts: evidence.relationCounts,
  featureCounts: evidence.featureCounts,
  moodFeatureCounts: evidence.moodFeatureCounts,
  verbTypeFeatureCounts: evidence.verbTypeFeatureCounts,
  auxRelationHeadPositionCounts: evidence.auxRelationHeadPositionCounts,
  preverbalAuxTokenCount: evidence.preverbalAuxTokenCount,
  postverbalAuxTokenCount: evidence.postverbalAuxTokenCount,
  preverbalAuxFormCounts: evidence.preverbalAuxFormCounts,
  postverbalAuxFormCounts: evidence.postverbalAuxFormCounts,
};

const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-aux-feature-inventory-v1",
  preverbalAuxEvidenceContract: "same-token-exact-aux-preverbal-v1",
  auxTokenCount: 3893,
  auxFormCount: 66,
  exactAuxCount: 1828,
  auxPassCount: 425,
  copCount: 1630,
  otherRelationCount: 10,
  aspectPerfCount: 824,
  aspectProgCount: 131,
  polarityNegCount: 112,
  voicePassCount: 425,
  preverbalAuxTokenCount: 875,
  postverbalAuxTokenCount: 953,
  postverbalForms: {
    了: 763,
    著: 130,
    過: 60,
  },
  preverbalAspectExceptions: {
    了: 1,
    著: 1,
  },
} as const;

const renderedSummary = JSON.stringify(summary, null, 2);
console.log(renderedSummary);

if (process.argv.includes("--verify")) {
  const failures: string[] = [];
  const relationTotal = Object.values(evidence.relationCounts).reduce((sum, count) => sum + count, 0);
  const otherRelationCount = relationTotal
    - (evidence.relationCounts.aux ?? 0)
    - (evidence.relationCounts["aux:pass"] ?? 0)
    - (evidence.relationCounts.cop ?? 0);

  const expectEqual = (label: string, observed: unknown, expected: unknown): void => {
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      failures.push(`${label}=${JSON.stringify(observed)}`);
    }
  };

  expectEqual("sourceCommit", summary.sourceCommit, EXPECTED_PINNED_BOUNDARY.sourceCommit);
  expectEqual("evidenceContract", summary.evidenceContract, EXPECTED_PINNED_BOUNDARY.evidenceContract);
  expectEqual(
    "preverbalAuxEvidenceContract",
    summary.preverbalAuxEvidenceContract,
    EXPECTED_PINNED_BOUNDARY.preverbalAuxEvidenceContract,
  );
  expectEqual("auxTokenCount", evidence.auxTokenCount, EXPECTED_PINNED_BOUNDARY.auxTokenCount);
  expectEqual("auxFormCount", evidence.auxFormCount, EXPECTED_PINNED_BOUNDARY.auxFormCount);
  expectEqual("relationCounts.aux", evidence.relationCounts.aux ?? 0, EXPECTED_PINNED_BOUNDARY.exactAuxCount);
  expectEqual(
    "relationCounts.aux:pass",
    evidence.relationCounts["aux:pass"] ?? 0,
    EXPECTED_PINNED_BOUNDARY.auxPassCount,
  );
  expectEqual("relationCounts.cop", evidence.relationCounts.cop ?? 0, EXPECTED_PINNED_BOUNDARY.copCount);
  expectEqual("otherRelationCount", otherRelationCount, EXPECTED_PINNED_BOUNDARY.otherRelationCount);
  expectEqual(
    "featureCounts.Aspect=Perf",
    evidence.featureCounts["Aspect=Perf"] ?? 0,
    EXPECTED_PINNED_BOUNDARY.aspectPerfCount,
  );
  expectEqual(
    "featureCounts.Aspect=Prog",
    evidence.featureCounts["Aspect=Prog"] ?? 0,
    EXPECTED_PINNED_BOUNDARY.aspectProgCount,
  );
  expectEqual(
    "featureCounts.Polarity=Neg",
    evidence.featureCounts["Polarity=Neg"] ?? 0,
    EXPECTED_PINNED_BOUNDARY.polarityNegCount,
  );
  expectEqual(
    "featureCounts.Voice=Pass",
    evidence.featureCounts["Voice=Pass"] ?? 0,
    EXPECTED_PINNED_BOUNDARY.voicePassCount,
  );
  expectEqual("moodFeatureCounts", evidence.moodFeatureCounts, {});
  expectEqual("verbTypeFeatureCounts", evidence.verbTypeFeatureCounts, {});
  expectEqual(
    "preverbalAuxTokenCount",
    evidence.preverbalAuxTokenCount,
    EXPECTED_PINNED_BOUNDARY.preverbalAuxTokenCount,
  );
  expectEqual(
    "postverbalAuxTokenCount",
    evidence.postverbalAuxTokenCount,
    EXPECTED_PINNED_BOUNDARY.postverbalAuxTokenCount,
  );
  expectEqual(
    "auxRelationHeadPositionCounts.preverbal",
    evidence.auxRelationHeadPositionCounts.preverbal ?? 0,
    EXPECTED_PINNED_BOUNDARY.preverbalAuxTokenCount,
  );
  expectEqual(
    "auxRelationHeadPositionCounts.postverbal",
    evidence.auxRelationHeadPositionCounts.postverbal ?? 0,
    EXPECTED_PINNED_BOUNDARY.postverbalAuxTokenCount,
  );
  expectEqual("auxRelationHeadPositionCounts.root", evidence.auxRelationHeadPositionCounts.root ?? 0, 0);
  expectEqual(
    "postverbalAuxFormCounts",
    evidence.postverbalAuxFormCounts,
    EXPECTED_PINNED_BOUNDARY.postverbalForms,
  );
  expectEqual(
    "preverbalAuxFormCounts.了",
    evidence.preverbalAuxFormCounts.了 ?? 0,
    EXPECTED_PINNED_BOUNDARY.preverbalAspectExceptions.了,
  );
  expectEqual(
    "preverbalAuxFormCounts.著",
    evidence.preverbalAuxFormCounts.著 ?? 0,
    EXPECTED_PINNED_BOUNDARY.preverbalAspectExceptions.著,
  );

  if (failures.length > 0) {
    throw new Error(
      `modality source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${renderedSummary}`,
    );
  }
}
