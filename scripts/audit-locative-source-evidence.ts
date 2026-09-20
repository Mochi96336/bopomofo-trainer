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


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-locative-shape-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  zaiTokenCount: 1_644,
  zaiUposCounts: { ADP: 1_061, ADV: 28, VERB: 555 },
  zaiVerbRootTokenCount: 21,
  zaiVerbRootWithSubjectTokenCount: 20,
  zaiVerbRootWithObjectTokenCount: 13,
  zaiVerbRootWithSubjectAndObjectTokenCount: 12,
  zaiAdpCaseTokenCount: 1_050,
  zaiCaseObliqueHeadTokenCount: 825,
  zaiCaseRootHeadTokenCount: 3,
  zaiCaseHeadWithCopAndSubjectTokenCount: 2,
  predicateWithZaiObliqueTokenCount: 825,
  predicateWithZaiObliqueVerbTokenCount: 821,
  youVerbTokenCount: 603,
  youVerbRootTokenCount: 254,
  youVerbWithZaiObliqueTokenCount: 35,
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
      `locative source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
