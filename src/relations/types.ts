import type { CommonnessTier } from "../commonness/tiers.js";
import type {
  BindingSkillScope,
  TokenId,
} from "../core/model.js";
import type {
  ConfusionSkillScope,
  TransitionSkillScope,
} from "../measurement/types.js";

export type RelationKind = "binding" | "transition" | "confusion";
export type CatalogPartition = "training" | "evaluation";

export interface CatalogOccurrenceBase {
  readonly entryId: string;
  readonly syllableIndex: number;
  readonly commonnessTier: CommonnessTier;
  readonly tags: readonly string[];
  readonly provenanceIds: readonly string[];
  readonly partition: CatalogPartition;
}

export interface BindingOccurrence extends CatalogOccurrenceBase {
  readonly kind: "binding";
  readonly tokenIndex: number;
  readonly tokenId: TokenId;
  readonly context: "syllable-start" | "within-syllable" | "tone";
  readonly entryInitial: boolean;
}

export interface TransitionOccurrence extends CatalogOccurrenceBase {
  readonly kind: "transition";
  readonly fromTokenIndex: number;
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
}

export type RelationOccurrence = BindingOccurrence | TransitionOccurrence;

export interface BindingRelationRef {
  readonly kind: "binding";
  readonly scope: BindingSkillScope;
}

export interface TransitionRelationRef {
  readonly kind: "transition";
  readonly scope: TransitionSkillScope;
}

export interface ConfusionRelationRef {
  readonly kind: "confusion";
  readonly scope: ConfusionSkillScope;
}

export type RelationRef =
  | BindingRelationRef
  | TransitionRelationRef
  | ConfusionRelationRef;

export type CommonnessTierCounts = Readonly<Record<CommonnessTier, number>>;

export interface RelationSupportSummary {
  readonly relation: RelationRef;
  readonly occurrenceCount: number;
  readonly distinctEntryCount: number;
  readonly commonnessTierCounts: CommonnessTierCounts;
  readonly commonEntryCount: number;
  readonly entryConcentration: number;
  readonly trainingOccurrenceCount: number;
  readonly trainingDistinctEntryCount: number;
  readonly trainingCommonEntryCount: number;
  readonly trainingEntryConcentration: number;
  readonly evaluationOccurrenceCount: number;
  readonly evaluationDistinctEntryCount: number;
  readonly evaluationCommonEntryCount: number;
  readonly supportState:
    | "unsupported"
    | "evaluation-only"
    | "rare-only"
    | "concentrated"
    | "supported";
}

export interface ConfusionContrastPool {
  readonly relation: ConfusionRelationRef;
  readonly expectedEntryIds: readonly string[];
  readonly actualEntryIds: readonly string[];
  readonly sharedEntryIds: readonly string[];
}

export interface CatalogRelationIndex {
  readonly bindingOccurrences: Readonly<Record<string, readonly BindingOccurrence[]>>;
  readonly transitionOccurrences: Readonly<Record<string, readonly TransitionOccurrence[]>>;
  readonly support: Readonly<Record<string, RelationSupportSummary>>;
  readonly confusionContrastPools: Readonly<Record<string, ConfusionContrastPool>>;
}
