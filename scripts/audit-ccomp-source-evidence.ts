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


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  contract: "pinned-gsd-ccomp-shape-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  ccompTokenCount: 2_156,
  ccompRelationCounts: { ccomp: 2_156 },
  ccompHeadUposCounts: {
    ADJ: 140,
    ADP: 2,
    ADV: 2,
    AUX: 2,
    NOUN: 193,
    NUM: 5,
    PART: 33,
    PROPN: 9,
    VERB: 1_769,
    X: 1,
  },
  governingHeadTokenCount: 2_156,
  governingHeadUposCounts: {
    ADJ: 16,
    ADP: 33,
    ADV: 6,
    NOUN: 20,
    NUM: 1,
    PART: 3,
    PRON: 1,
    PROPN: 1,
    VERB: 2_075,
  },
  governingHeadRelationCounts: {
    acl: 10,
    "acl:relcl": 82,
    advcl: 274,
    advmod: 3,
    amod: 4,
    appos: 3,
    ccomp: 190,
    compound: 1,
    conj: 11,
    csubj: 35,
    dislocated: 5,
    nsubj: 2,
    obj: 2,
    obl: 1,
    parataxis: 316,
    root: 1_032,
    xcomp: 185,
  },
  ccompBeforeGovernorTokenCount: 316,
  ccompAfterGovernorTokenCount: 1_840,
  embeddedWithOvertSubjectTokenCount: 2_123,
  embeddedWithoutOvertSubjectTokenCount: 33,
  embeddedWithNominalSubjectTokenCount: 2_065,
  embeddedWithClausalSubjectTokenCount: 59,
  governorWithSubjectTokenCount: 1_298,
  governorWithoutSubjectTokenCount: 858,
  governorWithNominalSubjectTokenCount: 1_190,
  governorWithClausalSubjectTokenCount: 108,
  governorWithObjectTokenCount: 155,
  governorWithoutObjectTokenCount: 2_001,
  governorWithIndirectObjectTokenCount: 0,
  governorWithAdditionalCcompTokenCount: 116,
  governorWithXcompTokenCount: 117,
  governorWithCopulaTokenCount: 21,
  governorRootTokenCount: 1_032,
  governorNonRootTokenCount: 1_124,
  ccompWithMarkChildTokenCount: 435,
  ccompWithoutMarkChildTokenCount: 1_721,
  ccompHeadIdentityCount: 1_280,
  governingHeadIdentityCount: 650,
  ccompHeadIdentityDigest:
    "060b1b5e3aea3b26ff04a9b5efd3c96142c06d0ecb99b35512a4a34ae1c470af",
  governingHeadIdentityDigest:
    "48718393004dd9e432e5019692eaac7801552620502f430c7e0078b9eafe8629",
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
      `ccomp source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(printable, null, 2)}`,
    );
  }
}
