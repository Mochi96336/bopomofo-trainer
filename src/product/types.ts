import type { CatalogEntry, Exercise, PracticeMode, TokenId } from "../core/model.js";
import type {
  CatalogSupportIndex,
  CurriculumEvidence,
  CurriculumPolicy,
  CurriculumProfile,
  FocusSelection,
} from "../curriculum/types.js";
import type {
  FrequencyFirstSelectionState,
  FrequencyFirstUtterancePolicy,
  FrequencyFirstUtteranceSelection,
} from "../curriculum/frequency-first-utterance.js";
import type { MeasurementSummaryV2 } from "../measurement-v2/aggregate.js";
import type { InteractionSessionStateV2 } from "../practice/interaction-session-v2.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

export const PRODUCT_PROGRESS_SCHEMA_VERSION = 7 as const;
export const PRODUCT_MEASUREMENT_EPOCH = "coordination-v1" as const;

export type ProductRoundKind = "practice" | "evaluation";

export interface ProductCatalogs {
  readonly practice: readonly CatalogEntry[];
  readonly evaluation: readonly CatalogEntry[];
  readonly syntaxProfiles: readonly RuntimeSyntaxProfile[];
}

export interface ProductRound {
  readonly kind: ProductRoundKind;
  readonly exercise: Exercise;
  readonly focus: FocusSelection | null;
  readonly selection: FrequencyFirstUtteranceSelection;
}

export interface ProductRoundSummary {
  readonly kind: ProductRoundKind;
  readonly exerciseId: string;
  readonly completedAt: string;
  readonly entryIds: readonly string[];
  readonly utteranceId: string;
  readonly templateId: string | null;
  readonly focusTokenId: TokenId | null;
  readonly focusEvidence: CurriculumEvidence | null;
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
}

export interface ProductProgress {
  readonly schemaVersion: typeof PRODUCT_PROGRESS_SCHEMA_VERSION;
  /** Separates evidence gathered under incompatible interaction semantics. */
  readonly measurementEpoch: typeof PRODUCT_MEASUREMENT_EPOCH;
  readonly seed: string;
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly measurements: MeasurementSummaryV2;
  readonly curriculumPolicyVersion: string;
  readonly curriculum: CurriculumProfile;
  readonly selection: FrequencyFirstSelectionState;
  readonly practiceRoundsCompleted: number;
  readonly recentSummaries: readonly ProductRoundSummary[];
}

export interface ProductEnvironment {
  readonly catalogs: ProductCatalogs;
  readonly practiceSupport: CatalogSupportIndex;
  readonly evaluationSupport: CatalogSupportIndex;
  readonly curriculumPolicy: CurriculumPolicy;
  readonly utterancePolicy: FrequencyFirstUtterancePolicy;
}

export interface ProductState {
  readonly progress: ProductProgress;
  readonly round: ProductRound;
  readonly session: InteractionSessionStateV2;
  readonly summary: ProductRoundSummary | null;
}
