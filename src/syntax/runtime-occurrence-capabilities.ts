import {
  RUNTIME_OCCURRENCE_CAPABILITIES,
  type RuntimeOccurrenceCapability,
} from "./types.js";

export const CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY: RuntimeOccurrenceCapability =
  "voice-cau-ccomp-same-occurrence";
export const BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY: RuntimeOccurrenceCapability =
  "ba-obl-patient-case-same-occurrence";

const REVIEWED_CAPABILITIES = new Set<string>(RUNTIME_OCCURRENCE_CAPABILITIES);

export function isReviewedRuntimeOccurrenceCapability(
  value: string,
): value is RuntimeOccurrenceCapability {
  return REVIEWED_CAPABILITIES.has(value);
}

/** Missing means no reviewed same-occurrence capability evidence. */
export function validRuntimeOccurrenceCapabilities(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const capability of value) {
    if (typeof capability !== "string"
      || !isReviewedRuntimeOccurrenceCapability(capability)
      || seen.has(capability)) {
      return false;
    }
    seen.add(capability);
  }
  return true;
}
