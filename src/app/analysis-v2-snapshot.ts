import type { ProductProgress } from "../product/types.js";
import type { ProgressHistory } from "../progress-history/types.js";
import type { SelectionTuning } from "./selection-tuning.js";

/**
 * Live app state handed to Analysis V2 at render time.
 *
 * This is deliberately a snapshot rather than a subscription. Analysis asks for
 * the running in-memory values whenever it renders, so blocked persistence can
 * never make the analysis describe an older stored session instead.
 */
export interface AnalysisV2Snapshot {
  readonly progress: ProductProgress;
  readonly progressHistory: ProgressHistory;
  readonly selectionTuning: SelectionTuning;
}
