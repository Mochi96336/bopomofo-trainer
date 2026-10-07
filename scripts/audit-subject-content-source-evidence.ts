import { auditPinnedSubjectContentSourceEvidence } from "./subject-content-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedSubjectContentSourceEvidence();

const governingPredicateCounts = Object.fromEntries(
  [...evidence.governingPredicateCounts]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hant")),
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
  governingPredicateCounts,
  governingPredicateIdentityCount: Object.keys(governingPredicateCounts).length,
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
