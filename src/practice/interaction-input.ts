import type { TokenId } from "../core/model.js";

/**
 * Browser-independent normalized practice input.
 *
 * This type intentionally describes the physical/semantic event only. It does
 * not encode an expected token or any session-version-specific interpretation.
 */
export interface PracticeInput {
  readonly timestampMs: number;
  readonly physicalCode: string;
  readonly actualToken: TokenId | null;
  readonly repeat: boolean;
  readonly composing: boolean;
  readonly modifierOnly: boolean;
}
