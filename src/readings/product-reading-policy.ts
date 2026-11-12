import type { CatalogEntry } from "../core/model.js";
import type { FormalSyntaxUtteranceInput } from "../curriculum/formal-syntax-utterance.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import {
  reviewedAdjacentPreDrawReadingEligible,
  reviewedAdjacentReadingEligible,
} from "./reviewed-adjacent-context.js";
import { reviewedMoeStandardBiReadingEligible } from "./moe-standard-bi.js";
import { reviewedMoeStandardDeReadingEligible } from "./moe-standard-de.js";
import { reviewedMoeStandardYuReadingEligible } from "./moe-standard-yu.js";
import { reviewedMoeStandardNanReadingEligible } from "./moe-standard-nan.js";
import { reviewedMoeStandardXingReadingEligible } from "./moe-standard-xing.js";
import { reviewedMoeOrdinalRoomReadingEligible } from "./moe-ordinal-room.js";
import { reviewedMoeNumericFenReadingEligible } from "./moe-numeric-fen.js";
import { reviewedMoeSupplementalRoleEligible, reviewedMoeSupplementFollowupRoleEligible, reviewedMoeExtendedRoleEligible, reviewedMoeQianRoleEligible } from "./moe-supplemental-role-license.js";
import { reviewedMoeStandardGuoReadingEligible } from "./moe-standard-guo.js";
import { reviewedMoeNaSurnameRoleEligible } from "./moe-na-surname-role.js";
import { reviewedMoeAttestedRoleEligible } from "./moe-attested-role-compatibility.js";
import { reviewedMoeFollowupRoleEligible } from "./moe-attested-role-compatibility.js";
import { reviewedMoeThirdRoleEligible } from "./moe-attested-role-compatibility.js";
import { reviewedMoeFourthRoleEligible, reviewedMoeFifthRoleEligible, reviewedMoeSixthRoleEligible, reviewedMoeSeventhRoleEligible, reviewedMoeEighthRoleEligible, reviewedMoeTenthRoleEligible } from "./moe-attested-role-compatibility.js";
import { reviewedHanCoordinationReadingEligible } from "./han-coordination-license.js";

/** Current production boundary; historical audit modes remain separately frozen. */
export const PRODUCT_READING_POLICY_ID = "standard-han-coordination-trial";

export const PRODUCT_READING_POLICY = {
  readingEligibility: (
    entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: unknown,
    previousEntry: CatalogEntry | null,
  ) =>
    reviewedHanCoordinationReadingEligible(entry, profile)
      && reviewedAdjacentReadingEligible(entry, profile, slot, previousEntry),
  preDrawReadingEligibility: (
    entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: unknown,
    previousEntry: CatalogEntry | null,
  ) =>
    reviewedHanCoordinationReadingEligible(entry, profile)
      && reviewedAdjacentPreDrawReadingEligible(entry, profile, slot, previousEntry),
  finalCandidateReadingEligibility: reviewedMoeStandardBiReadingEligible,
  subsequentFinalCandidateReadingEligibility: reviewedMoeStandardDeReadingEligible,
  additionalFinalCandidateReadingEligibilities: [
    reviewedMoeStandardYuReadingEligible,
    reviewedMoeStandardNanReadingEligible,
    reviewedMoeStandardXingReadingEligible,
    reviewedMoeStandardGuoReadingEligible,
    reviewedMoeNaSurnameRoleEligible,
    reviewedMoeAttestedRoleEligible,
    reviewedMoeFollowupRoleEligible,
    reviewedMoeThirdRoleEligible,
    reviewedMoeFourthRoleEligible,
    reviewedMoeFifthRoleEligible,
    reviewedMoeSixthRoleEligible,
    reviewedMoeSeventhRoleEligible,
    reviewedMoeEighthRoleEligible,
    reviewedMoeOrdinalRoomReadingEligible,
    reviewedMoeTenthRoleEligible,
    reviewedMoeNumericFenReadingEligible,
    reviewedMoeSupplementalRoleEligible,
    reviewedMoeSupplementFollowupRoleEligible,
    reviewedMoeExtendedRoleEligible,
    reviewedMoeQianRoleEligible,
  ],
} as const satisfies Pick<FormalSyntaxUtteranceInput,
  "readingEligibility" | "preDrawReadingEligibility" | "finalCandidateReadingEligibility"
  | "subsequentFinalCandidateReadingEligibility" | "additionalFinalCandidateReadingEligibilities">;

type ProfileGate = (
  entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: unknown, previous: CatalogEntry | null,
) => boolean;
const finalGates: readonly ProfileGate[] = [
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
  PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
];

/**
 * Static profile inspection only. No preceding word is supplied, so local
 * contextual restrictions are not evidence of universal reachability or of a
 * correct pronunciation. Actual product probes use all gates before weighting; historical replay retains their ordering.
 */
export function productReadingEligibleWithoutPreviousEntry(
  entry: CatalogEntry, profile: RuntimeSyntaxProfile,
): boolean {
  return PRODUCT_READING_POLICY.readingEligibility(entry, profile, null, null)
    && PRODUCT_READING_POLICY.preDrawReadingEligibility(entry, profile, null, null)
    && finalGates.every(gate => gate(entry, profile, null, null));
}
