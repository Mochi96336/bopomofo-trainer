import type { CatalogSupportIndex } from "../curriculum/types.js";
import type { ProductProgress } from "../product/types.js";
import type { ProgressHistory } from "../progress-history/types.js";

/**
 * Live app state handed to Analysis V2 at render time.
 *
 * This is deliberately a snapshot rather than a subscription. Analysis asks for
 * the running in-memory values whenever it renders, so blocked persistence can
 * never make the analysis describe an older stored session instead.
 *
 * `practiceSupport` is the app-owned full-catalog support index. Analysis uses
 * it only to interpret which semantic tokens exist and which can carry motor
 * timing evidence; it does not construct a second ProductEnvironment.
 */
export interface AnalysisV2Snapshot {
  readonly progress: ProductProgress;
  readonly progressHistory: ProgressHistory;
  readonly practiceSupport: CatalogSupportIndex;
}
