import {
  auditPinnedNonverbalCcompGovernorSourceEvidence,
} from "./nonverbal-ccomp-governor-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedNonverbalCcompGovernorSourceEvidence();

const topIdentities = Object.fromEntries(
  [...evidence.governorIdentityCounts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 40),
);

const summary = {
  auditVersion: "nonverbal-ccomp-governor-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  totalCcompTokenCount: evidence.totalCcompTokenCount,
  nonverbalGovernorTokenCount: evidence.nonverbalGovernorTokenCount,
  governorUposCounts: evidence.governorUposCounts,
  governorIdentityCount: evidence.governorIdentityCounts.size,
  governorIdentityDigest: evidence.governorIdentityDigest,
  topGovernorIdentities: topIdentities,
  governorRelationCounts: evidence.governorRelationCounts,
  governorUposRelationCounts: evidence.governorUposRelationCounts,
  governorRootUposCounts: evidence.governorRootUposCounts,
  governorNonRootUposCounts: evidence.governorNonRootUposCounts,
  governorWithSubjectUposCounts: evidence.governorWithSubjectUposCounts,
  governorWithoutSubjectUposCounts: evidence.governorWithoutSubjectUposCounts,
  governorWithCopulaUposCounts: evidence.governorWithCopulaUposCounts,
  governorWithObjectUposCounts: evidence.governorWithObjectUposCounts,
  governorWithAdditionalCcompUposCounts: evidence.governorWithAdditionalCcompUposCounts,
  governorWithXcompUposCounts: evidence.governorWithXcompUposCounts,
  ccompBeforeGovernorUposCounts: evidence.ccompBeforeGovernorUposCounts,
  ccompAfterGovernorUposCounts: evidence.ccompAfterGovernorUposCounts,
  ccompHeadUposByGovernorUposCounts: evidence.ccompHeadUposByGovernorUposCounts,
  ccompWithMarkerUposCounts: evidence.ccompWithMarkerUposCounts,
  ccompWithoutMarkerUposCounts: evidence.ccompWithoutMarkerUposCounts,
  ccompMarkerFormByGovernorUposCounts: evidence.ccompMarkerFormByGovernorUposCounts,
};

console.log(JSON.stringify({ ...summary, occurrences: evidence.occurrences }, null, 2));
