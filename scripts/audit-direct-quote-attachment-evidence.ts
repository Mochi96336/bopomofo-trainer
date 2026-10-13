import { auditPinnedDirectQuoteAttachmentEvidence } from "./direct-quote-attachment-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedDirectQuoteAttachmentEvidence();
const summary = {
  auditVersion: "direct-quote-attachment-identity-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  contract: evidence.contract,
  candidateCount: evidence.candidateCount,
  relationCounts: evidence.relationCounts,
  relationByGovernorUposCounts: evidence.relationByGovernorUposCounts,
  relationByGovernorRootStatusCounts: evidence.relationByGovernorRootStatusCounts,
  relationByGovernorSubjectPresenceCounts: evidence.relationByGovernorSubjectPresenceCounts,
  relationByQuoteOrderCounts: evidence.relationByQuoteOrderCounts,
  relationByGovernorObjectPresenceCounts: evidence.relationByGovernorObjectPresenceCounts,
  relationByOtherCcompPresenceCounts: evidence.relationByOtherCcompPresenceCounts,
  relationByXcompPresenceCounts: evidence.relationByXcompPresenceCounts,
  relationByOtherParataxisPresenceCounts: evidence.relationByOtherParataxisPresenceCounts,
  governorIdentityCount: evidence.governorIdentityCount,
  governorIdentityCounts: evidence.governorIdentityCounts,
  uniqueGovernorIdentityCountByRelation: evidence.uniqueGovernorIdentityCountByRelation,
  crossRelationGovernorIdentityCount: evidence.crossRelationGovernorIdentityCount,
  crossRelationGovernorIdentities: evidence.crossRelationGovernorIdentities,
  relationPairSharedGovernorIdentityCounts: evidence.relationPairSharedGovernorIdentityCounts,
  occurrenceDigest: evidence.occurrenceDigest,
  governorIdentityRelationDigest: evidence.governorIdentityRelationDigest,
};

console.log(JSON.stringify({ ...summary, occurrences: evidence.occurrences }, null, 2));


const EXPECTED_PINNED_BOUNDARY = {
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  contract: "pinned-gsd-direct-quote-attachment-identity-v1",
  candidateCount: 90,
  relationCounts: {
    ccomp: 54,
    obj: 3,
    parataxis: 16,
    xcomp: 17,
  },
  relationByGovernorUposCounts: {
    "ccomp\u0000ADP": 1,
    "ccomp\u0000VERB": 53,
    "obj\u0000VERB": 3,
    "parataxis\u0000NOUN": 2,
    "parataxis\u0000PART": 1,
    "parataxis\u0000VERB": 13,
    "xcomp\u0000VERB": 17,
  },
  relationByGovernorSubjectPresenceCounts: {
    "ccomp\u0000no-subject": 8,
    "ccomp\u0000subject": 46,
    "obj\u0000no-subject": 2,
    "obj\u0000subject": 1,
    "parataxis\u0000subject": 16,
    "xcomp\u0000no-subject": 4,
    "xcomp\u0000subject": 13,
  },
  relationByQuoteOrderCounts: {
    "ccomp\u0000quote-after": 53,
    "ccomp\u0000quote-before": 1,
    "obj\u0000quote-after": 3,
    "parataxis\u0000quote-after": 16,
    "xcomp\u0000quote-after": 15,
    "xcomp\u0000quote-before": 2,
  },
  governorIdentityCount: 53,
  uniqueGovernorIdentityCountByRelation: {
    ccomp: 29,
    obj: 3,
    parataxis: 16,
    xcomp: 13,
  },
  crossRelationGovernorIdentityCount: 5,
  crossRelationGovernorIdentities: [
    {
      identity: "說\u0000VERB",
      form: "說",
      upos: "VERB",
      relations: ["ccomp", "obj", "xcomp"],
      occurrenceCount: 13,
    },
    {
      identity: "表示\u0000VERB",
      form: "表示",
      upos: "VERB",
      relations: ["ccomp", "parataxis", "xcomp"],
      occurrenceCount: 6,
    },
    {
      identity: "是\u0000VERB",
      form: "是",
      upos: "VERB",
      relations: ["ccomp", "parataxis", "xcomp"],
      occurrenceCount: 4,
    },
    {
      identity: "為\u0000VERB",
      form: "為",
      upos: "VERB",
      relations: ["ccomp", "xcomp"],
      occurrenceCount: 3,
    },
    {
      identity: "說道\u0000VERB",
      form: "說道",
      upos: "VERB",
      relations: ["ccomp", "xcomp"],
      occurrenceCount: 2,
    },
  ],
  relationPairSharedGovernorIdentityCounts: {
    "ccomp|obj": 1,
    "ccomp|parataxis": 2,
    "ccomp|xcomp": 5,
    "obj|parataxis": 0,
    "obj|xcomp": 1,
    "parataxis|xcomp": 2,
  },
  occurrenceDigest: "72c952c47b15722bde65d951103ad42c7e8473aefe40061861ec62aa8636dad0",
  governorIdentityRelationDigest:
    "2d55079f13071f8b1620cdf6444a7010cd147d5f3d545fabf6a17edc4e7dd987",
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
      `direct-quote attachment evidence drifted from the pinned reviewed boundary: ${failures.join(", ")}\n`
      + `expected: ${JSON.stringify(EXPECTED_PINNED_BOUNDARY, null, 2)}\n`
      + `observed: ${JSON.stringify(summary, null, 2)}`,
    );
  }
}
