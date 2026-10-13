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
