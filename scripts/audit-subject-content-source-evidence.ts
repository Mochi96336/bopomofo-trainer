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


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-csubj-shape-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  clausalSubjectTokenCount: 375,
  clausalSubjectRelationCounts: {
    csubj: 369,
    "csubj:pass": 6,
  },
  subjectClauseHeadUposCounts: {
    ADJ: 25,
    ADP: 1,
    NOUN: 34,
    PART: 3,
    PRON: 1,
    VERB: 311,
  },
  governingPredicateTokenCount: 375,
  governingPredicateUposCounts: {
    ADJ: 28,
    ADP: 2,
    ADV: 1,
    AUX: 1,
    NOUN: 60,
    NUM: 4,
    PART: 4,
    PRON: 1,
    PROPN: 4,
    VERB: 269,
    X: 1,
  },
  governingPredicateRelationCounts: {
    "acl:relcl": 11,
    advcl: 19,
    appos: 1,
    ccomp: 59,
    conj: 3,
    csubj: 10,
    parataxis: 71,
    root: 181,
    xcomp: 20,
  },
  governingPredicateIdentityCount: 213,
  governingPredicateIdentityDigest:
    "7c19504965afca794265feccd3a57b57e7a60dd4bcf767076165f60dd9609227",
  subjectClauseBeforePredicateTokenCount: 375,
  subjectClauseAfterPredicateTokenCount: 0,
  subjectClauseWithOvertSubjectTokenCount: 203,
  subjectClauseWithoutOvertSubjectTokenCount: 172,
  predicateWithAdditionalSubjectTokenCount: 1,
  predicateWithoutAdditionalSubjectTokenCount: 374,
  predicateRootTokenCount: 181,
  predicateNonRootTokenCount: 194,
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
      `subject-content source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
