import { auditPinnedQuotedContentSourceEvidence } from "./quoted-content-source-evidence.js";
import {
  UD_GSD_PROVENANCE_ID,
  UD_GSD_SOURCE_COMMIT,
  UD_GSD_SOURCE_VERSION,
} from "./ud-occurrence-source.js";

const evidence = await auditPinnedQuotedContentSourceEvidence();
const summary = {
  auditVersion: "quoted-content-source-shape-inventory-v1",
  sourceProvenanceId: UD_GSD_PROVENANCE_ID,
  sourceVersion: UD_GSD_SOURCE_VERSION,
  sourceCommit: UD_GSD_SOURCE_COMMIT,
  contract: evidence.contract,
  sentenceCount: evidence.sentenceCount,
  tokenCount: evidence.tokenCount,
  quotePunctuationFormCounts: evidence.quotePunctuationFormCounts,
  cornerQuoteSpanCount: evidence.cornerQuoteSpanCount,
  spanWithNoBoundaryRootCount: evidence.spanWithNoBoundaryRootCount,
  spanWithSingleBoundaryRootCount: evidence.spanWithSingleBoundaryRootCount,
  spanWithMultipleBoundaryRootsCount: evidence.spanWithMultipleBoundaryRootsCount,
  standaloneQuotedRootCount: evidence.standaloneQuotedRootCount,
  externallyAttachedQuotedRootCount: evidence.externallyAttachedQuotedRootCount,
  quotedRootRelationCounts: evidence.quotedRootRelationCounts,
  quotedRootUposCounts: evidence.quotedRootUposCounts,
  quotedRootIdentityCount: evidence.quotedRootIdentityCounts.size,
  quotedRootIdentityDigest: evidence.quotedRootIdentityDigest,
  governorUposCounts: evidence.governorUposCounts,
  governorRelationCounts: evidence.governorRelationCounts,
  governorIdentityCount: evidence.governorIdentityCounts.size,
  governorIdentityDigest: evidence.governorIdentityDigest,
  governorRootCount: evidence.governorRootCount,
  governorNonRootCount: evidence.governorNonRootCount,
  governorWithSubjectCount: evidence.governorWithSubjectCount,
  governorWithoutSubjectCount: evidence.governorWithoutSubjectCount,
  governorWithNominalSubjectCount: evidence.governorWithNominalSubjectCount,
  governorWithClausalSubjectCount: evidence.governorWithClausalSubjectCount,
  governorWithObjectCount: evidence.governorWithObjectCount,
  governorWithOtherCcompCount: evidence.governorWithOtherCcompCount,
  governorWithXcompCount: evidence.governorWithXcompCount,
  governorWithOtherParataxisCount: evidence.governorWithOtherParataxisCount,
  quotedRootWithSubjectCount: evidence.quotedRootWithSubjectCount,
  quotedRootWithoutSubjectCount: evidence.quotedRootWithoutSubjectCount,
  quoteBeforeGovernorCount: evidence.quoteBeforeGovernorCount,
  quoteAfterGovernorCount: evidence.quoteAfterGovernorCount,
};

console.log(JSON.stringify({ ...summary, occurrences: evidence.occurrences }, null, 2));
