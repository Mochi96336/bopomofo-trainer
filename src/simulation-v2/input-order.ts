import type { Exercise, InputLayout, TokenId } from "../core/model.js";
import { assignedHandForCode, type AssignedHand } from "../motor/keyboard-geometry.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
  type InteractionSessionStateV2,
} from "../practice/interaction-session-v2.js";
import type { InputSlot } from "../practice/input-plan.js";

export type InputOrderStrategy =
  | "canonical"
  | "reverse-body"
  | "random-valid"
  | "hand-alternating";

export interface InputOrderSimulationOptions {
  readonly startTimestampMs?: number;
  readonly intervalMs?: number;
  readonly random?: () => number;
}

function reverseLayout(layout: InputLayout): ReadonlyMap<TokenId, string> {
  const result = new Map<TokenId, string>();
  for (const [code, token] of Object.entries(layout.bindings)) {
    if (!result.has(token)) result.set(token, code);
  }
  return result;
}

function shuffled<T>(values: readonly T[], random: () => number): readonly T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function explicitHandForSlot(
  slot: InputSlot,
  codeByToken: ReadonlyMap<TokenId, string>,
): AssignedHand {
  const code = codeByToken.get(slot.tokenId);
  return code === undefined ? "unknown" : assignedHandForCode(code);
}

function alternatingSlots(
  slots: readonly InputSlot[],
  codeByToken: ReadonlyMap<TokenId, string>,
): readonly InputSlot[] {
  const remaining = [...slots];
  const result: InputSlot[] = [];
  let previousHand: AssignedHand | null = null;

  while (remaining.length > 0) {
    const preferred = previousHand === "left" || previousHand === "right"
      ? remaining.findIndex((slot) => {
          const hand = explicitHandForSlot(slot, codeByToken);
          return (hand === "left" || hand === "right") && hand !== previousHand;
        })
      : -1;
    const index = preferred >= 0 ? preferred : 0;
    const [slot] = remaining.splice(index, 1);
    if (slot === undefined) break;
    result.push(slot);
    const hand = explicitHandForSlot(slot, codeByToken);
    if (hand === "left" || hand === "right") previousHand = hand;
  }

  return result;
}

export function orderBodySlots(
  slots: readonly InputSlot[],
  strategy: InputOrderStrategy,
  layout: InputLayout,
  random: () => number = Math.random,
): readonly InputSlot[] {
  switch (strategy) {
    case "canonical":
      return [...slots];
    case "reverse-body":
      return [...slots].reverse();
    case "random-valid":
      return shuffled(slots, random);
    case "hand-alternating":
      return alternatingSlots(slots, reverseLayout(layout));
  }
}

export function simulateInputOrder(
  exercise: Exercise,
  layout: InputLayout,
  strategy: InputOrderStrategy,
  options: InputOrderSimulationOptions = {},
): InteractionSessionStateV2 {
  if (exercise.layoutId !== layout.id) {
    throw new Error(`exercise layout ${exercise.layoutId} does not match ${layout.id}`);
  }
  const codeByToken = reverseLayout(layout);
  const intervalMs = options.intervalMs ?? 50;
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new RangeError("intervalMs must be finite and non-negative");
  }
  let timestamp = options.startTimestampMs ?? 0;
  let state = createInteractionSessionV2(exercise, timestamp);

  for (const syllable of state.plan.syllables) {
    const body = orderBodySlots(
      syllable.bodySlots,
      strategy,
      layout,
      options.random ?? Math.random,
    );
    for (const slot of [...body, syllable.toneSlot]) {
      const physicalCode = codeByToken.get(slot.tokenId);
      if (physicalCode === undefined) {
        throw new Error(`layout ${layout.id} has no physical key for ${slot.tokenId}`);
      }
      timestamp += intervalMs;
      state = applyInteractionInputV2(state, {
        timestampMs: timestamp,
        physicalCode,
        actualToken: slot.tokenId,
        repeat: false,
        composing: false,
        modifierOnly: false,
      });
    }
  }

  return state;
}
