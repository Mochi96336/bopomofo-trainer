import { auditPinnedXcompControllerSourceEvidence } from "./xcomp-controller-source-evidence.js";
import { UD_GSD_PROVENANCE_ID } from "./ud-occurrence-source.js";

const evidence = await auditPinnedXcompControllerSourceEvidence();
const summary = {
  auditVersion: "xcomp-controller-source-evidence-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: evidence.sourceVersion,
  sourceCommit: evidence.sourceCommit,
  contract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  xcompCount: evidence.xcompCount,
  subjectControllerCount: evidence.subjectControllerCount,
  objectControllerCount: evidence.objectControllerCount,
  otherControllerCount: evidence.otherControllerCount,
  unresolvedCount: evidence.unresolvedCount,
  basicObjectPlusXcompCount: evidence.basicObjectPlusXcompCount,
  unresolvedBasicObjectPlusXcompCount: evidence.unresolvedBasicObjectPlusXcompCount,
  enhancedXsubjEdgeCount: evidence.enhancedXsubjEdgeCount,
  occurrenceDigest: evidence.occurrenceDigest,
};

console.log(JSON.stringify(summary, null, 2));


const EXPECTED_PINNED_BOUNDARY = {
  sourceVersion: "r2.18",
  sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
  contract: "pinned-gsd-xcomp-controller-evidence-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  xcompCount: 1_924,
  subjectControllerCount: 0,
  objectControllerCount: 0,
  otherControllerCount: 0,
  unresolvedCount: 1_924,
  basicObjectPlusXcompCount: 208,
  unresolvedBasicObjectPlusXcompCount: 208,
  enhancedXsubjEdgeCount: 0,
  occurrenceDigest:
    "614c21c9fc9b5953337801f26ae8f2a65482f152c8d93be12e543aeb2c72ede3",
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
      `xcomp controller source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
