export type AssignedHand = "left" | "right" | "ambiguous" | "unknown";

export interface PhysicalKeyErgonomics {
  readonly code: string;
  readonly assignedHand: AssignedHand;
}

const LEFT_HAND_CODES = new Set([
  "Backquote",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "KeyB",
  "Tab",
  "CapsLock",
  "ShiftLeft",
]);

const RIGHT_HAND_CODES = new Set([
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "Minus",
  "Equal",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "KeyH",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Semicolon",
  "Quote",
  "KeyN",
  "KeyM",
  "Comma",
  "Period",
  "Slash",
  "ShiftRight",
  "Enter",
  "Backspace",
]);

/**
 * Returns the conventional touch-typing hand assignment for a physical key.
 *
 * This is ergonomic metadata about `KeyboardEvent.code`, not about a Bopomofo
 * token. `ambiguous` means the physical key is conventionally usable by either
 * hand (currently Space); `unknown` means the geometry does not make a claim.
 */
export function assignedHandForCode(code: string): AssignedHand {
  if (code === "Space") return "ambiguous";
  if (LEFT_HAND_CODES.has(code)) return "left";
  if (RIGHT_HAND_CODES.has(code)) return "right";
  return "unknown";
}

export function physicalKeyErgonomics(code: string): PhysicalKeyErgonomics {
  return {
    code,
    assignedHand: assignedHandForCode(code),
  };
}
