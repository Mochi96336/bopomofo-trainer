import type { InputLayout } from "../core/model.js";
import type { PracticeInput } from "../practice/interaction-input.js";

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

export function isInspectionAdvanceShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F8");
}

export function isInspectionUnlockShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F9");
}

export function isInspectionCompleteShortcut(event: KeyboardLikeEvent): boolean {
  return isBareFunctionKey(event, "F10");
}

export function keyboardEventToInput(
  event: KeyboardLikeEvent,
  layout: InputLayout,
  timestampMs: number,
  compositionActive: boolean,
): PracticeInput {
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
