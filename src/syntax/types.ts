import type {
  FORMAL_GRAMMAR_VERSION,
  SYNTAX_CATEGORIES,
  SYNTAX_FEATURE_NAMES,
} from "./features.js";

export const UPOS_VALUES = [
  "ADJ", "ADP", "ADV", "AUX", "CCONJ", "DET", "INTJ", "NOUN", "NUM",
  "PART", "PRON", "PROPN", "PUNCT", "SCONJ", "SYM", "VERB", "X",
] as const;
export type Upos = (typeof UPOS_VALUES)[number];

export const SYNTACTIC_FUNCTIONS = [
  "subject", "object", "indirect-object", "predicate", "modifier", "adverbial",
  "oblique", "complement", "adposition", "determiner", "numeral", "classifier",
  "auxiliary", "copula", "marker", "coordinator", "conjunct", "punctuation",
  "discourse", "unspecified",
] as const;
export type SyntacticFunction = (typeof SYNTACTIC_FUNCTIONS)[number];

export const VALENCY_FRAMES = [
  "avalent", "intransitive", "transitive", "ditransitive", "ambitransitive",
  "copular", "clausal-complement", "open-clausal-complement", "adpositional-complement",
  "serial-verb", "causative", "resultative",
  "subject-controlled-open-complement", "object-controlled-open-complement",
] as const;
export type ValencyFrame = (typeof VALENCY_FRAMES)[number];

/**
 * Reviewed capabilities that require multiple facts to be observed on the same
 * corpus token occurrence. Keep these separate from aggregate valency and
 * morphology so consumers cannot silently reconstruct the same claim by ANDing
 * independent evidence dimensions.
 */
export const RUNTIME_OCCURRENCE_CAPABILITIES = [
  "voice-cau-ccomp-same-occurrence",
  "ba-obl-patient-case-same-occurrence",
] as const;
export type RuntimeOccurrenceCapability = (typeof RUNTIME_OCCURRENCE_CAPABILITIES)[number];

export type SyntaxEvidenceScope = "per-upos" | "aggregate-legacy";
export type DependencyCountMap = Readonly<Record<string, number>>;

export interface AnonymousDependencySkeletonNode {
  readonly upos: Upos;
  readonly relation: string;
  readonly direction: "head-left" | "head-right" | "root" | "child-left" | "child-right";
  readonly children?: readonly AnonymousDependencySkeletonNode[];
}
export interface AnonymousDependencySkeletonEvidence {
  readonly count: number;
  readonly skeleton: AnonymousDependencySkeletonNode;
}
export interface SyntaxCompatibilityEvidence {
  readonly dependencyRelationCounts: DependencyCountMap;
  readonly surfacePositionCounts: DependencyCountMap;
  /**
   * Runtime morphology was added after the v1 active-profile artifact shipped.
   * Keep it optional so those committed profiles remain readable; source-profile
   * projections below still require the complete morphology count map.
   */
  readonly morphologicalFeatureCounts?: DependencyCountMap;
}
export interface DependencyEvidence extends SyntaxCompatibilityEvidence {
  readonly evidenceScope: SyntaxEvidenceScope;
  readonly occurrenceCount: number;
  readonly morphologicalFeatureCounts: DependencyCountMap;
  readonly parentUposCounts: DependencyCountMap;
  readonly headDirectionCounts: DependencyCountMap;
  readonly surfacePositionCounts: DependencyCountMap;
  readonly childRelationCounts: DependencyCountMap;
  readonly childDirectionRelationCounts: DependencyCountMap;
  readonly childRelationMultisetCounts: DependencyCountMap;
  readonly valencyRelationCounts: DependencyCountMap;
  readonly valencySignatureCounts: DependencyCountMap;
  readonly constructionRelationCounts: DependencyCountMap;
  readonly anonymousDependencySkeletons: readonly AnonymousDependencySkeletonEvidence[];
  readonly rootCount: number;
}
export interface RuntimeSyntaxProfile {
  readonly id: string;
  readonly entryId: string;
  readonly upos: Upos;
  readonly functions: readonly SyntacticFunction[];
  readonly valencyFrames: readonly ValencyFrame[];
  readonly occurrenceCapabilities?: readonly RuntimeOccurrenceCapability[];
  readonly dependencyEvidence: SyntaxCompatibilityEvidence;
}

export interface GrammarRule {
  readonly id: string;
  readonly category: (typeof SYNTAX_CATEGORIES)[number];
  readonly constituents: readonly ProductionConstituent[];
  readonly constraints?: readonly ProductionConstraint[];
}

export interface ProductionConstituent {
  readonly key: string;
  readonly category?: (typeof SYNTAX_CATEGORIES)[number];
  readonly lexical?: boolean;
  readonly literal?: string;
  readonly requiredUpos?: readonly Upos[];
  readonly requiredFunctions?: readonly SyntacticFunction[];
  readonly requiredValencyFrames?: readonly ValencyFrame[];
  readonly requiredOccurrenceCapabilities?: readonly RuntimeOccurrenceCapability[];
  readonly requiredFeatures?: Partial<Record<(typeof SYNTAX_FEATURE_NAMES)[number], string>>;
  readonly inheritFunctions?: boolean;
  readonly inheritValencyFrames?: boolean;
  readonly inheritOccurrenceCapabilities?: boolean;
  readonly inheritFeatures?: boolean;
  readonly min: number;
  readonly max: number;
  readonly recursive?: boolean;
}

export type ProductionConstraint = ProductionPresenceConstraint | ProductionFeatureConstraint;

export interface ProductionPresenceConstraint {
  readonly kind: "presence";
  readonly ifPresent: string;
  readonly thenPresent: string;
}

export interface ProductionFeatureConstraint {
  readonly kind: "feature";
  readonly left: string;
  readonly leftFeature: (typeof SYNTAX_FEATURE_NAMES)[number];
  readonly right: string;
  readonly rightFeature: (typeof SYNTAX_FEATURE_NAMES)[number];
  readonly relation: "equal" | "not-equal";
}

export interface GrammarBundle {
  readonly version: typeof FORMAL_GRAMMAR_VERSION;
  readonly rules: readonly GrammarRule[];
}
