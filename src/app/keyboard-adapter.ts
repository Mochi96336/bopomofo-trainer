import type { InputLayout } from "../core/model.js";
import type { InteractionInput } from "../practice/interaction-session.js";

const MODIFIER_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
]);

export interface KeyboardLikeEvent {
  readonly code: string;
  readonly key: string;
  readonly repeat: boolean;
  readonly isComposing: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

function isBareFunctionKey(event: KeyboardLikeEvent, code: string): boolean {
  return event.code === code
    && !event.repeat
    && !event.isComposing
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey;
}

/** Hidden local-review shortcut; intentionally absent from the visible UI. */
export function isInspectionAdvanceShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F8");
}

/**
 * Hidden local-review shortcut that opens every commonness level for the
 * current page only, so rarer vocabulary can be inspected without practising
 * up to it. It writes nothing, so it cannot be mistaken for earned progress.
 */
export function isInspectionUnlockShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F9");
}

/** Hidden local-review shortcut that finishes the current sentence. */
export function isInspectionCompleteShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F10");
}

export function keyboardEventToInput(
  event: KeyboardLikeEvent,
  layout: InputLayout,
  timestampMs: number,
  compositionActive: boolean,
): InteractionInput {
  const composing = compositionActive || event.isComposing || event.key === "Process";
  const shortcutModified = event.altKey || event.ctrlKey || event.metaKey;

  return {
    timestampMs,
    physicalCode: event.code,
    actualToken: layout.bindings[event.code] ?? null,
    repeat: event.repeat,
    composing,
    modifierOnly: MODIFIER_CODES.has(event.code) || shortcutModified,
  };
}
