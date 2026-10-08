import { createHash } from "node:crypto";
import {
  auditPinnedConstituentSubjectQuestionSourceEvidence,
} from "./constituent-subject-question-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

function digestCounts(values: ReadonlyMap<string, number>): string {
  return createHash("sha256")
    .update(JSON.stringify([...values].sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))), "utf8")
    .digest("hex");
}

const evidence = await auditPinnedConstituentSubjectQuestionSourceEvidence();

const summary = {
  auditVersion: "constituent-subject-question-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  interrogativeTokenCount: evidence.interrogativeTokenCount,
  interrogativeFormCounts: evidence.interrogativeFormCounts,
  interrogativeUposCounts: evidence.interrogativeUposCounts,
  interrogativeRelationCounts: evidence.interrogativeRelationCounts,
  directSubjectTokenCount: evidence.directSubjectTokenCount,
  directSubjectFormCounts: evidence.directSubjectFormCounts,
  directSubjectUposCounts: evidence.directSubjectUposCounts,
  directSubjectRelationCounts: evidence.directSubjectRelationCounts,
  directSubjectIdentityCount: evidence.directSubjectIdentityCounts.size,
  directSubjectIdentityDigest: digestCounts(evidence.directSubjectIdentityCounts),
  governingHeadTokenCount: evidence.governingHeadTokenCount,
  governingHeadUposCounts: evidence.governingHeadUposCounts,
  governingHeadRelationCounts: evidence.governingHeadRelationCounts,
  governingHeadIdentityCount: evidence.governingHeadIdentityCounts.size,
  governingHeadIdentityDigest: digestCounts(evidence.governingHeadIdentityCounts),
  governingHeadChildRelationCounts: evidence.governingHeadChildRelationCounts,
  subjectBeforeHeadTokenCount: evidence.subjectBeforeHeadTokenCount,
  subjectAfterHeadTokenCount: evidence.subjectAfterHeadTokenCount,
  governingHeadWithAdditionalSubjectTokenCount:
    evidence.governingHeadWithAdditionalSubjectTokenCount,
  governingHeadWithoutAdditionalSubjectTokenCount:
    evidence.governingHeadWithoutAdditionalSubjectTokenCount,
  governingHeadWithObjectTokenCount: evidence.governingHeadWithObjectTokenCount,
  governingHeadWithoutObjectTokenCount: evidence.governingHeadWithoutObjectTokenCount,
  governingHeadWithIndirectObjectTokenCount: evidence.governingHeadWithIndirectObjectTokenCount,
  governingHeadWithCopulaTokenCount: evidence.governingHeadWithCopulaTokenCount,
  governingHeadWithClausalComplementTokenCount:
    evidence.governingHeadWithClausalComplementTokenCount,
  governingHeadRootTokenCount: evidence.governingHeadRootTokenCount,
  governingHeadNonRootTokenCount: evidence.governingHeadNonRootTokenCount,
};

console.log(JSON.stringify(summary, null, 2));
