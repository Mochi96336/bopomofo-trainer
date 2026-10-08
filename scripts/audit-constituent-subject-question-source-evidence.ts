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
  rootDirectSubjectFormCounts: evidence.rootDirectSubjectFormCounts,
  rootGoverningHeadUposCounts: evidence.rootGoverningHeadUposCounts,
  rootGoverningHeadIdentityCount: evidence.rootGoverningHeadIdentityCounts.size,
  rootGoverningHeadIdentityDigest: digestCounts(evidence.rootGoverningHeadIdentityCounts),
};

console.log(JSON.stringify(summary, null, 2));


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-licensed-wh-direct-subject-shape-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  interrogativeTokenCount: 74,
  interrogativeFormCounts: {
    "什麼": 13,
    "多少": 3,
    "何": 9,
    "何時": 1,
    "甚麼": 2,
    "哪": 1,
    "哪裡": 2,
    "幾": 37,
    "誰": 6,
  },
  interrogativeUposCounts: {
    ADV: 1,
    DET: 1,
    NUM: 40,
    PRON: 25,
    PROPN: 7,
  },
  interrogativeRelationCounts: {
    advmod: 1,
    appos: 1,
    conj: 1,
    det: 5,
    nmod: 5,
    nsubj: 9,
    nummod: 38,
    obj: 7,
    obl: 7,
  },
  directSubjectTokenCount: 9,
  directSubjectFormCounts: {
    "什麼": 2,
    "何": 3,
    "誰": 4,
  },
  directSubjectUposCounts: {
    PRON: 6,
    PROPN: 3,
  },
  directSubjectRelationCounts: {
    nsubj: 9,
  },
  directSubjectIdentityCount: 3,
  directSubjectIdentityDigest:
    "06f184453f6219f657136819c0bc5f884e80590511503d211379100e0e183220",
  governingHeadTokenCount: 9,
  governingHeadUposCounts: {
    ADJ: 2,
    VERB: 7,
  },
  governingHeadRelationCounts: {
    advcl: 1,
    appos: 1,
    ccomp: 3,
    csubj: 2,
    parataxis: 1,
    root: 1,
  },
  governingHeadIdentityCount: 9,
  governingHeadIdentityDigest:
    "5f6d8892c6d7653fe7586af848b2f0da167119386779c1c11d5c9ad13dc452ce",
  governingHeadChildRelationCounts: {
    advcl: 1,
    advmod: 2,
    aux: 3,
    ccomp: 2,
    "discourse:sp": 1,
    "nmod:tmod": 2,
    nsubj: 9,
    obj: 3,
    obl: 2,
    punct: 10,
  },
  subjectBeforeHeadTokenCount: 9,
  subjectAfterHeadTokenCount: 0,
  governingHeadWithAdditionalSubjectTokenCount: 0,
  governingHeadWithoutAdditionalSubjectTokenCount: 9,
  governingHeadWithObjectTokenCount: 3,
  governingHeadWithoutObjectTokenCount: 6,
  governingHeadWithIndirectObjectTokenCount: 0,
  governingHeadWithCopulaTokenCount: 0,
  governingHeadWithClausalComplementTokenCount: 2,
  governingHeadRootTokenCount: 1,
  governingHeadNonRootTokenCount: 8,
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
      `constituent-subject-question source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
