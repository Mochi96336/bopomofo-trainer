import type { ProductProgress } from "../product/types.js";
import type { ProgressHistory } from "../progress-history/types.js";
import type { SelectionTuning } from "./selection-tuning.js";

/**
 * What the running shell is currently practising against, handed over directly.
 *
 * The diagnostics layer used to reconstruct this from module-level mirrors kept
 * beside each storage module -- the last value that had been successfully
 * written to `localStorage`. That made the two layers agree only for as long as
 * storage kept accepting writes. When it stopped, the shell went on running the
 * session in memory, exactly as a degraded local session is supposed to, while
 * diagnostics carried on describing the last state that happened to persist. The
 * product promises that practice continues when storage is blocked; it does not
 * promise that the analysis of it silently describes a different session.
 *
 * Passing the live values removes the second source. It is deliberately a
 * snapshot rather than a subscription: every reader asks at the moment it
 * renders, so there is no cached copy on this side to go stale either.
 */
export interface DiagnosticSnapshot {
  readonly progress: ProductProgress;
  readonly progressHistory: ProgressHistory;
  readonly selectionTuning: SelectionTuning;
}
