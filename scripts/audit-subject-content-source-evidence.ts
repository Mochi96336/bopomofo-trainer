import { createHash } from "node:crypto";
import { auditPinnedSubjectContentSourceEvidence } from "./subject-content-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedSubjectContentSourceEvidence();

const governingPredicateEntries = [...evidence.governingPredicateCounts]
  .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
const governingPredicateIdentityDigest = createHash("sha256")
  .update(JSON.stringify(governingPredicateEntries), "utf8")
  .digest("hex");
const topGoverningPredicateCounts = Object.fromEntries(
  [...evidence.governingPredicateCounts]
    .sort((left, right) => right[1] - left[1]
      || left[0].localeCompare(right[0], "zh-Hant"))
    .slice(0, 20),
);

const summary = {
  auditVersion: "subject-content-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  clausalSubjectTokenCount: evidence.clausalSubjectTokenCount,
  clausalSubjectRelationCounts: evidence.clausalSubjectRelationCounts,
  subjectClauseHeadUposCounts: evidence.subjectClauseHeadUposCounts,
  governingPredicateTokenCount: evidence.governingPredicateTokenCount,
  governingPredicateUposCounts: evidence.governingPredicateUposCounts,
  governingPredicateRelationCounts: evidence.governingPredicateRelationCounts,
  governingPredicateIdentityCount: evidence.governingPredicateCounts.size,
  governingPredicateIdentityDigest,
  topGoverningPredicateCounts,
  subjectClauseBeforePredicateTokenCount: evidence.subjectClauseBeforePredicateTokenCount,
  subjectClauseAfterPredicateTokenCount: evidence.subjectClauseAfterPredicateTokenCount,
  subjectClauseWithOvertSubjectTokenCount: evidence.subjectClauseWithOvertSubjectTokenCount,
  subjectClauseWithoutOvertSubjectTokenCount: evidence.subjectClauseWithoutOvertSubjectTokenCount,
  predicateWithAdditionalSubjectTokenCount: evidence.predicateWithAdditionalSubjectTokenCount,
  predicateWithoutAdditionalSubjectTokenCount: evidence.predicateWithoutAdditionalSubjectTokenCount,
  predicateRootTokenCount: evidence.predicateRootTokenCount,
  predicateNonRootTokenCount: evidence.predicateNonRootTokenCount,
};

console.log(JSON.stringify(summary, null, 2));
