import { auditPinnedLocativeSourceEvidence } from "./locative-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

function topEntries(
  values: Readonly<Record<string, number>>,
  limit = 30,
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))
      .slice(0, limit),
  );
}

const evidence = await auditPinnedLocativeSourceEvidence();

const summary = {
  auditVersion: "locative-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  zaiTokenCount: evidence.zaiTokenCount,
  zaiUposCounts: evidence.zaiUposCounts,
  zaiRelationCounts: evidence.zaiRelationCounts,
  zaiVerbTokenCount: evidence.zaiVerbTokenCount,
  zaiVerbRootTokenCount: evidence.zaiVerbRootTokenCount,
  zaiVerbRootWithSubjectTokenCount: evidence.zaiVerbRootWithSubjectTokenCount,
  zaiVerbRootWithObjectTokenCount: evidence.zaiVerbRootWithObjectTokenCount,
  zaiVerbRootWithSubjectAndObjectTokenCount: evidence.zaiVerbRootWithSubjectAndObjectTokenCount,
  zaiVerbWithSubjectTokenCount: evidence.zaiVerbWithSubjectTokenCount,
  zaiVerbWithNominalComplementTokenCount: evidence.zaiVerbWithNominalComplementTokenCount,
  zaiVerbWithCopChildTokenCount: evidence.zaiVerbWithCopChildTokenCount,
  zaiVerbChildRelationCounts: evidence.zaiVerbChildRelationCounts,
  zaiAdpCaseTokenCount: evidence.zaiAdpCaseTokenCount,
  zaiCaseHeadRelationCounts: evidence.zaiCaseHeadRelationCounts,
  zaiCaseObliqueHeadTokenCount: evidence.zaiCaseObliqueHeadTokenCount,
  zaiCaseRootHeadTokenCount: evidence.zaiCaseRootHeadTokenCount,
  zaiCaseHeadWithCopTokenCount: evidence.zaiCaseHeadWithCopTokenCount,
  zaiCaseHeadWithSubjectTokenCount: evidence.zaiCaseHeadWithSubjectTokenCount,
  zaiCaseHeadWithCopAndSubjectTokenCount: evidence.zaiCaseHeadWithCopAndSubjectTokenCount,
  zaiCaseHeadUposCounts: evidence.zaiCaseHeadUposCounts,
  predicateWithZaiObliqueTokenCount: evidence.predicateWithZaiObliqueTokenCount,
  predicateWithZaiObliqueVerbTokenCount: evidence.predicateWithZaiObliqueVerbTokenCount,
  predicateWithZaiObliqueUposCounts: evidence.predicateWithZaiObliqueUposCounts,
  topPredicateWithZaiObliqueFormCounts: topEntries(evidence.predicateWithZaiObliqueFormCounts),
  obliqueCaseMarkerTokenCount: evidence.obliqueCaseMarkerTokenCount,
  topObliqueCaseMarkerFormCounts: topEntries(evidence.obliqueCaseMarkerFormCounts),
  youVerbTokenCount: evidence.youVerbTokenCount,
  youVerbRootTokenCount: evidence.youVerbRootTokenCount,
  youVerbWithSubjectTokenCount: evidence.youVerbWithSubjectTokenCount,
  youVerbWithObjectTokenCount: evidence.youVerbWithObjectTokenCount,
  youVerbWithZaiObliqueTokenCount: evidence.youVerbWithZaiObliqueTokenCount,
};

console.log(JSON.stringify(summary, null, 2));
