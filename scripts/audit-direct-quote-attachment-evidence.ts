import { auditPinnedDirectQuoteAttachmentEvidence } from "./direct-quote-attachment-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedDirectQuoteAttachmentEvidence();
const summary = {
  auditVersion: "direct-quote-attachment-identity-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  contract: evidence.contract,
  candidateCount: evidence.candidateCount,
  relationCounts: evidence.relationCounts,
  relationByGovernorUposCounts: evidence.relationByGovernorUposCounts,
  relationByGovernorRootStatusCounts: evidence.relationByGovernorRootStatusCounts,
  relationByGovernorSubjectPresenceCounts: evidence.relationByGovernorSubjectPresenceCounts,
  relationByQuoteOrderCounts: evidence.relationByQuoteOrderCounts,
  relationByGovernorObjectPresenceCounts: evidence.relationByGovernorObjectPresenceCounts,
  relationByOtherCcompPresenceCounts: evidence.relationByOtherCcompPresenceCounts,
  relationByXcompPresenceCounts: evidence.relationByXcompPresenceCounts,
  relationByOtherParataxisPresenceCounts: evidence.relationByOtherParataxisPresenceCounts,
  governorIdentityCount: evidence.governorIdentityCount,
  governorIdentityCounts: evidence.governorIdentityCounts,
  uniqueGovernorIdentityCountByRelation: evidence.uniqueGovernorIdentityCountByRelation,
  crossRelationGovernorIdentityCount: evidence.crossRelationGovernorIdentityCount,
  crossRelationGovernorIdentities: evidence.crossRelationGovernorIdentities,
  relationPairSharedGovernorIdentityCounts: evidence.relationPairSharedGovernorIdentityCounts,
  occurrenceDigest: evidence.occurrenceDigest,
  governorIdentityRelationDigest: evidence.governorIdentityRelationDigest,
};

console.log(JSON.stringify({ ...summary, occurrences: evidence.occurrences }, null, 2));
