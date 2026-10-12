import {
  auditPinnedCcompSourceEvidence,
} from "./ccomp-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedCcompSourceEvidence();

const summary = {
  auditVersion: "ccomp-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  ...evidence,
  ccompHeadIdentityCount: evidence.ccompHeadIdentityCounts.size,
  governingHeadIdentityCount: evidence.governingHeadIdentityCounts.size,
};

const printable = {
  ...summary,
  ccompHeadIdentityCounts: undefined,
  governingHeadIdentityCounts: undefined,
};

console.log(JSON.stringify(printable, null, 2));
