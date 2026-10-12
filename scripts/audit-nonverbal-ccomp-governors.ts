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
  ccompCaseFormByGovernorUposCounts: evidence.ccompCaseFormByGovernorUposCounts,
  ccompCaseFormByGovernorIdentityCounts: evidence.ccompCaseFormByGovernorIdentityCounts,
};

console.log(JSON.stringify({ ...summary, occurrences: evidence.occurrences }, null, 2));


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-nonverbal-ccomp-governor-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  totalCcompTokenCount: 2_156,
  nonverbalGovernorTokenCount: 81,
  governorUposCounts: {
    ADJ: 16,
    ADP: 33,
    ADV: 6,
    NOUN: 20,
    NUM: 1,
    PART: 3,
    PRON: 1,
    PROPN: 1,
  },
  governorIdentityCount: 51,
  governorIdentityDigest:
    "2f301680e3014404217523135d3ea7d38d1ccfc85f6c0daf6c0c3abe83e747a7",
  governorRootUposCounts: {
    ADJ: 10,
    ADP: 9,
    ADV: 2,
    NOUN: 8,
    NUM: 1,
    PART: 1,
  },
  governorNonRootUposCounts: {
    ADJ: 6,
    ADP: 24,
    ADV: 4,
    NOUN: 12,
    PART: 2,
    PRON: 1,
    PROPN: 1,
  },
  governorWithSubjectUposCounts: {
    ADJ: 13,
    ADP: 6,
    ADV: 1,
    NOUN: 11,
    NUM: 1,
    PART: 3,
  },
  governorWithoutSubjectUposCounts: {
    ADJ: 3,
    ADP: 27,
    ADV: 5,
    NOUN: 9,
    PRON: 1,
    PROPN: 1,
  },
  governorWithCopulaUposCounts: {
    ADJ: 4,
    NOUN: 13,
    NUM: 1,
    PART: 3,
  },
  governorWithObjectUposCounts: {},
  governorWithAdditionalCcompUposCounts: {},
  governorWithXcompUposCounts: {
    ADJ: 1,
  },
  ccompBeforeGovernorUposCounts: {
    ADJ: 12,
    NOUN: 13,
    NUM: 1,
    PART: 3,
    PROPN: 1,
  },
  ccompAfterGovernorUposCounts: {
    ADJ: 4,
    ADP: 33,
    ADV: 6,
    NOUN: 7,
    PRON: 1,
  },
  ccompWithMarkerUposCounts: {
    ADJ: 4,
    ADP: 5,
    ADV: 2,
    NOUN: 3,
    NUM: 1,
  },
  ccompWithoutMarkerUposCounts: {
    ADJ: 12,
    ADP: 28,
    ADV: 4,
    NOUN: 17,
    PART: 3,
    PRON: 1,
    PROPN: 1,
  },
  ccompCaseFormByGovernorUposCounts: {
    "ADJ\u0000比": 1,
    "ADJ\u0000由於": 1,
    "ADJ\u0000因": 1,
    "ADJ\u0000因為": 3,
    "ADJ\u0000在": 1,
    "ADJ\u0000如": 1,
    "ADJ\u0000和": 1,
    "ADJ\u0000與": 3,
    "ADJ\u0000儘管": 1,
    "ADJ\u0000雖": 1,
    "ADJ\u0000雖然": 1,
    "ADP\u0000老": 1,
    "NOUN\u0000由於": 1,
    "NOUN\u0000因": 1,
    "NOUN\u0000因為": 3,
    "NOUN\u0000如果": 2,
    "NOUN\u0000即使": 1,
    "NOUN\u0000到": 1,
    "NOUN\u0000儘管": 1,
    "NOUN\u0000雖": 1,
    "NOUN\u0000雖然": 1,
    "NUM\u0000就": 1,
    "PART\u0000如果": 1,
    "PART\u0000若是": 1,
    "PART\u0000根據": 1,
    "PROPN\u0000雖然": 1,
  },
  ccompCaseFormByGovernorIdentityCounts: {
    "一樣\u0000ADJ\u0000與": 1,
    "一\u0000NUM\u0000就": 1,
    "人\u0000PART\u0000根據": 1,
    "分別\u0000NOUN\u0000因為": 1,
    "方形\u0000NOUN\u0000因為": 1,
    "止\u0000NOUN\u0000到": 1,
    "危險\u0000ADJ\u0000因為": 1,
    "因為\u0000ADP\u0000老": 1,
    "地\u0000NOUN\u0000由於": 1,
    "有關\u0000ADJ\u0000和": 1,
    "有關\u0000ADJ\u0000與": 2,
    "車站\u0000NOUN\u0000即使": 1,
    "杯水車薪\u0000ADJ\u0000雖然": 1,
    "法\u0000PART\u0000如果": 1,
    "法\u0000PART\u0000若是": 1,
    "很多\u0000ADJ\u0000由於": 1,
    "重大\u0000ADJ\u0000雖": 1,
    "重要\u0000ADJ\u0000因為": 1,
    "風格\u0000NOUN\u0000雖": 1,
    "倍\u0000NOUN\u0000如果": 1,
    "海拔\u0000NOUN\u0000如果": 1,
    "般\u0000ADJ\u0000如": 1,
    "國旗\u0000NOUN\u0000因為": 1,
    "強大\u0000ADJ\u0000因為": 1,
    "順利\u0000ADJ\u0000因": 1,
    "會堂\u0000NOUN\u0000雖然": 1,
    "蜥蜴\u0000NOUN\u0000因": 1,
    "凝滯\u0000ADJ\u0000在": 1,
    "辦法\u0000NOUN\u0000儘管": 1,
    "優惠\u0000ADJ\u0000比": 1,
    "謝\u0000PROPN\u0000雖然": 1,
    "穩定\u0000ADJ\u0000儘管": 1,
  },
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
      `nonverbal ccomp governor evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
