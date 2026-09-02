export const BA_FORMAL_COMPLETION_WITNESSES = [
  "aspect",
  "postverbal-argument",
  "clausal-complement",
  "oblique-complement",
  "marker-linked-argument",
  "directional-complement",
  "extension-complement",
] as const;

export type BaFormalCompletionWitness = (typeof BA_FORMAL_COMPLETION_WITNESSES)[number];

export interface BaPredicateLicensingInput {
  readonly upos: string;
  /** Direct reviewed same-occurrence `obl:patient + case(把|將)` evidence. */
  readonly directBaOccurrence: boolean;
  /** Productive lexical argument capability; intentionally independent of BA attestation. */
  readonly patientTaking: boolean;
  /** Formal completion realized by this derivation, not historical aggregate evidence. */
  readonly completionWitnesses: readonly BaFormalCompletionWitness[];
}

export type BaPredicateLicensingDecision =
  | {
      readonly allowed: true;
      readonly path: "attested" | "productive-completed";
      readonly completionWitnesses: readonly BaFormalCompletionWitness[];
    }
  | {
      readonly allowed: false;
      readonly reason: "non-verbal-head" | "missing-patient-capability" | "missing-completion";
    };

/**
 * Prototype ownership boundary for canonical BA licensing.
 *
 * The attested path is a positive backstop for lexicalized/bare predicates that
 * the current formal predicate-structure inventory cannot decompose. The
 * productive path generalizes to unseen BA combinations, but only when the
 * lexical head can take a patient and the CURRENT derivation realizes an
 * explicit formal completion. Corpus non-attestation is never negative evidence.
 */
export function decideBaPredicateLicensing(
  input: BaPredicateLicensingInput,
): BaPredicateLicensingDecision {
  if (input.upos !== "VERB") {
    return { allowed: false, reason: "non-verbal-head" };
  }
  if (input.directBaOccurrence) {
    return {
      allowed: true,
      path: "attested",
      completionWitnesses: input.completionWitnesses,
    };
  }
  if (!input.patientTaking) {
    return { allowed: false, reason: "missing-patient-capability" };
  }
  if (input.completionWitnesses.length === 0) {
    return { allowed: false, reason: "missing-completion" };
  }
  return {
    allowed: true,
    path: "productive-completed",
    completionWitnesses: [...new Set(input.completionWitnesses)].sort(),
  };
}
