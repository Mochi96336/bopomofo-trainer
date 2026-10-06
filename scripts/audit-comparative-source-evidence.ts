import { auditPinnedComparativeSourceEvidence } from "./comparative-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedComparativeSourceEvidence();

const comparativePredicateCounts = Object.fromEntries(
  [...evidence.comparativePredicateCounts]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hant")),
);

const summary = {
  auditVersion: "comparative-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  biTokenCount: evidence.biTokenCount,
  biUposRelationCounts: evidence.biUposRelationCounts,
  exactCaseAdpTokenCount: evidence.exactCaseAdpTokenCount,
  standardHeadUposCounts: evidence.standardHeadUposCounts,
  standardRelationCounts: evidence.standardRelationCounts,
  nominalStandardTokenCount: evidence.nominalStandardTokenCount,
  governingPredicateTokenCount: evidence.governingPredicateTokenCount,
  governingPredicateUposCounts: evidence.governingPredicateUposCounts,
  governingPredicateRelationCounts: evidence.governingPredicateRelationCounts,
  comparativePredicateCounts,
  comparativePredicateIdentityCount: Object.keys(comparativePredicateCounts).length,
  adjectivalPredicateTokenCount: evidence.adjectivalPredicateTokenCount,
  verbalPredicateTokenCount: evidence.verbalPredicateTokenCount,
  markerBeforeStandardTokenCount: evidence.markerBeforeStandardTokenCount,
  standardBeforePredicateTokenCount: evidence.standardBeforePredicateTokenCount,
  predicateWithSubjectTokenCount: evidence.predicateWithSubjectTokenCount,
  predicateWithoutSubjectTokenCount: evidence.predicateWithoutSubjectTokenCount,
  predicateRootTokenCount: evidence.predicateRootTokenCount,
  predicateNonRootTokenCount: evidence.predicateNonRootTokenCount,
};

console.log(JSON.stringify(summary, null, 2));

const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  evidenceContract: "pinned-gsd-bi-comparative-shape-inventory-v1",
  sentenceCount: 4_997,
  tokenCount: 123_289,
  biTokenCount: 50,
  biUposRelationCounts: {
    "ADP\u0000case": 41,
    "CCONJ\u0000cc": 5,
    "VERB\u0000advcl": 1,
    "VERB\u0000ccomp": 1,
    "VERB\u0000csubj": 1,
    "VERB\u0000root": 1,
  },
  exactCaseAdpTokenCount: 41,
  standardHeadUposCounts: {
    NOUN: 25,
    PART: 7,
    PRON: 2,
    PROPN: 1,
    VERB: 2,
    X: 4,
  },
  standardRelationCounts: {
    ccomp: 1,
    nmod: 31,
    obl: 8,
    xcomp: 1,
  },
  nominalStandardTokenCount: 28,
  governingPredicateTokenCount: 41,
  governingPredicateUposCounts: {
    ADJ: 32,
    VERB: 9,
  },
  adjectivalPredicateTokenCount: 32,
  verbalPredicateTokenCount: 9,
  markerBeforeStandardTokenCount: 41,
  standardBeforePredicateTokenCount: 41,
  predicateWithSubjectTokenCount: 25,
  predicateWithoutSubjectTokenCount: 16,
  predicateRootTokenCount: 9,
  predicateNonRootTokenCount: 32,
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
      `comparative source evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
