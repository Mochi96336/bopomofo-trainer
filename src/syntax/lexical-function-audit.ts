import type { RuntimeSyntaxProfile, SyntacticFunction, Upos } from "./types.js";

const NOMINAL_UPOS = new Set<Upos>(["NOUN", "PRON", "PROPN"]);
const VERBAL_UPOS = new Set<Upos>(["VERB", "AUX", "ADJ"]);

function entryIdsMatching(
  profiles: readonly RuntimeSyntaxProfile[],
  predicate: (profile: RuntimeSyntaxProfile) => boolean,
): ReadonlySet<string> {
  return new Set(profiles.filter(predicate).map((profile) => profile.entryId));
}

function hasFunction(profile: RuntimeSyntaxProfile, value: SyntacticFunction): boolean {
  return profile.functions.includes(value);
}

function intersectionSize(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

export interface LexicalFunctionGatingAudit {
  readonly profileCount: number;
  readonly entryCount: number;
  readonly nominal: {
    readonly entries: number;
    readonly observedSubject: number;
    readonly observedObject: number;
    readonly observedOblique: number;
    readonly subjectAndObject: number;
    readonly objectAndOblique: number;
    readonly subjectAndOblique: number;
    readonly withoutSubjectObservation: number;
    readonly withoutObjectObservation: number;
    readonly withoutObliqueObservation: number;
  };
  readonly verbal: {
    readonly entries: number;
    readonly observedPredicate: number;
    readonly withoutPredicateObservation: number;
    readonly transitiveCapable: number;
    readonly transitiveCapableAndObservedPredicate: number;
    readonly transitiveCapableWithoutPredicateObservation: number;
  };
}

/**
 * Measures the reachability cost of treating observed UD dependency roles as
 * lexical eligibility. This is diagnostic only: it does not decide which roles
 * should become lexical capabilities in Clause-model v2.
 */
export function auditLexicalFunctionGating(
  profiles: readonly RuntimeSyntaxProfile[],
): LexicalFunctionGatingAudit {
  const allEntries = entryIdsMatching(profiles, () => true);
  const nominalEntries = entryIdsMatching(profiles, (profile) => NOMINAL_UPOS.has(profile.upos));
  const nominalSubject = entryIdsMatching(
    profiles,
    (profile) => NOMINAL_UPOS.has(profile.upos) && hasFunction(profile, "subject"),
  );
  const nominalObject = entryIdsMatching(
    profiles,
    (profile) => NOMINAL_UPOS.has(profile.upos) && hasFunction(profile, "object"),
  );
  const nominalOblique = entryIdsMatching(
    profiles,
    (profile) => NOMINAL_UPOS.has(profile.upos) && hasFunction(profile, "oblique"),
  );

  const verbalEntries = entryIdsMatching(profiles, (profile) => VERBAL_UPOS.has(profile.upos));
  const verbalPredicate = entryIdsMatching(
    profiles,
    (profile) => VERBAL_UPOS.has(profile.upos) && hasFunction(profile, "predicate"),
  );
  const transitiveCapable = entryIdsMatching(
    profiles,
    (profile) => VERBAL_UPOS.has(profile.upos)
      && profile.valencyFrames.some((frame) => frame === "transitive" || frame === "ambitransitive"),
  );
  const transitivePredicate = entryIdsMatching(
    profiles,
    (profile) => VERBAL_UPOS.has(profile.upos)
      && hasFunction(profile, "predicate")
      && profile.valencyFrames.some((frame) => frame === "transitive" || frame === "ambitransitive"),
  );

  return {
    profileCount: profiles.length,
    entryCount: allEntries.size,
    nominal: {
      entries: nominalEntries.size,
      observedSubject: nominalSubject.size,
      observedObject: nominalObject.size,
      observedOblique: nominalOblique.size,
      subjectAndObject: intersectionSize(nominalSubject, nominalObject),
      objectAndOblique: intersectionSize(nominalObject, nominalOblique),
      subjectAndOblique: intersectionSize(nominalSubject, nominalOblique),
      withoutSubjectObservation: nominalEntries.size - nominalSubject.size,
      withoutObjectObservation: nominalEntries.size - nominalObject.size,
      withoutObliqueObservation: nominalEntries.size - nominalOblique.size,
    },
    verbal: {
      entries: verbalEntries.size,
      observedPredicate: verbalPredicate.size,
      withoutPredicateObservation: verbalEntries.size - verbalPredicate.size,
      transitiveCapable: transitiveCapable.size,
      transitiveCapableAndObservedPredicate: transitivePredicate.size,
      transitiveCapableWithoutPredicateObservation: transitiveCapable.size - transitivePredicate.size,
    },
  };
}
