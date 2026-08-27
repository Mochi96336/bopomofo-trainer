import type { SyntaxEvidenceArtifact } from "./profile-projection.js";
import type { Upos } from "./types.js";

const PREDICATE_UPOS = new Set<Upos>(["VERB", "AUX", "ADJ"]);
const CURRENT_COMPLEMENT_RELATIONS = ["obj", "iobj", "ccomp", "xcomp", "obl"] as const;

export interface ValencyEvidenceSemanticsFinding {
  readonly text: string;
  readonly upos: Upos;
  readonly occurrenceCount: number;
  /** At least one occurrence contains obj/iobj and at least one does not. */
  readonly mixedNominalObjectRealization: boolean;
  /**
   * Current projection can add `intransitive` because at least one occurrence
   * lacks every relation in CURRENT_COMPLEMENT_RELATIONS. This is occurrence
   * absence evidence, not independent proof of lexical intransitivity.
   */
  readonly complementlessOccurrenceFeedsIntransitive: boolean;
  /**
   * Current projection can add `ambitransitive` because nominal-object evidence
   * and a complementless occurrence coexist somewhere in the aggregate profile.
   * The two observations need not establish lexical alternation.
   */
  readonly mixedOccurrenceFeedsAmbitransitive: boolean;
  /**
   * Current projection can add `adpositional-complement` from base `obl`.
   * The projector has already erased dependency subtypes at this layer, so the
   * aggregate cannot distinguish selected complements from ordinary obliques.
   */
  readonly genericObliqueFeedsAdpositionalComplement: boolean;
}

export interface ValencyEvidenceSemanticsAudit {
  readonly predicateProfileCount: number;
  readonly mixedNominalObjectRealizationProfileCount: number;
  readonly complementlessOccurrenceFeedsIntransitiveProfileCount: number;
  readonly mixedOccurrenceFeedsAmbitransitiveProfileCount: number;
  readonly genericObliqueFeedsAdpositionalComplementProfileCount: number;
  readonly findings: readonly ValencyEvidenceSemanticsFinding[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function signatureCounts(signature: string): Readonly<Record<string, number>> {
  if (signature === "none") return {};
  const result: Record<string, number> = {};
  for (const item of signature.split("|")) {
    const [relation, rawCount] = item.split("=");
    const count = Number(rawCount);
    if (relation === undefined || relation.length === 0 || !Number.isInteger(count) || count <= 0) {
      throw new Error(`invalid valency signature: ${signature}`);
    }
    result[relation] = count;
  }
  return result;
}

function findingFor(
  text: string,
  upos: Upos,
  occurrenceCount: number,
  valencySignatureCounts: Readonly<Record<string, number>> | undefined,
): ValencyEvidenceSemanticsFinding {
  let hasNominalObjectBearingOccurrence = false;
  let hasNominalObjectlessOccurrence = false;
  let hasComplementlessOccurrence = false;
  let hasGenericObliqueOccurrence = false;

  for (const [signature, observations] of Object.entries(valencySignatureCounts ?? {})) {
    if (!Number.isInteger(observations) || observations < 0) {
      throw new Error(`invalid valency signature observation count for ${text}/${upos}: ${signature}`);
    }
    if (observations === 0) continue;
    const counts = signatureCounts(signature);
    const hasNominalObject = (counts.obj ?? 0) > 0 || (counts.iobj ?? 0) > 0;
    const hasCurrentComplement = CURRENT_COMPLEMENT_RELATIONS.some(
      (relation) => (counts[relation] ?? 0) > 0,
    );

    hasNominalObjectBearingOccurrence ||= hasNominalObject;
    hasNominalObjectlessOccurrence ||= !hasNominalObject;
    hasComplementlessOccurrence ||= !hasCurrentComplement;
    hasGenericObliqueOccurrence ||= (counts.obl ?? 0) > 0;
  }

  return {
    text,
    upos,
    occurrenceCount,
    mixedNominalObjectRealization:
      hasNominalObjectBearingOccurrence && hasNominalObjectlessOccurrence,
    complementlessOccurrenceFeedsIntransitive: hasComplementlessOccurrence,
    mixedOccurrenceFeedsAmbitransitive:
      hasNominalObjectBearingOccurrence && hasComplementlessOccurrence,
    genericObliqueFeedsAdpositionalComplement: hasGenericObliqueOccurrence,
  };
}

/**
 * Audit the semantic distance between occurrence evidence and the current
 * lexical-looking ValencyFrame projection. This function is intentionally not
 * used by grammar generation or product selection; it exists to narrow claims
 * before the Formal Syntax V2 valency migration changes runtime behavior.
 */
export function auditValencyEvidenceSemantics(
  artifact: SyntaxEvidenceArtifact,
): ValencyEvidenceSemanticsAudit {
  const findings: ValencyEvidenceSemanticsFinding[] = [];
  let predicateProfileCount = 0;

  for (const row of artifact.rows) {
    for (const profile of row.syntaxProfileEvidence ?? []) {
      const upos = profile.upos as Upos;
      if (!PREDICATE_UPOS.has(upos)) continue;
      predicateProfileCount += 1;
      const finding = findingFor(
        row.text,
        upos,
        profile.occurrenceCount,
        profile.valencySignatureCounts,
      );
      if (finding.mixedNominalObjectRealization
        || finding.complementlessOccurrenceFeedsIntransitive
        || finding.mixedOccurrenceFeedsAmbitransitive
        || finding.genericObliqueFeedsAdpositionalComplement) {
        findings.push(finding);
      }
    }
  }

  findings.sort((left, right) => compareText(left.text, right.text) || compareText(left.upos, right.upos));
  return {
    predicateProfileCount,
    mixedNominalObjectRealizationProfileCount: findings.filter(
      (item) => item.mixedNominalObjectRealization,
    ).length,
    complementlessOccurrenceFeedsIntransitiveProfileCount: findings.filter(
      (item) => item.complementlessOccurrenceFeedsIntransitive,
    ).length,
    mixedOccurrenceFeedsAmbitransitiveProfileCount: findings.filter(
      (item) => item.mixedOccurrenceFeedsAmbitransitive,
    ).length,
    genericObliqueFeedsAdpositionalComplementProfileCount: findings.filter(
      (item) => item.genericObliqueFeedsAdpositionalComplement,
    ).length,
    findings,
  };
}
