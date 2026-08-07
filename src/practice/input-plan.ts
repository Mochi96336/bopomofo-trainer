import type { Exercise, TokenId } from "../core/model.js";

export type InputSlotKind = "body" | "tone";

export interface InputSlot {
  readonly id: string;
  readonly tokenId: TokenId;
  readonly canonicalTokenIndex: number;
  readonly kind: InputSlotKind;
}

export interface SyllableInputPlan {
  readonly id: string;
  readonly ordinal: number;
  readonly entryId: string;
  readonly entryIndex: number;
  readonly syllableIndex: number;
  readonly bodySlots: readonly InputSlot[];
  readonly toneSlot: InputSlot;
}

export interface ExerciseInputPlan {
  readonly exerciseId: string;
  readonly syllables: readonly SyllableInputPlan[];
  readonly totalSlots: number;
}

function isToneToken(tokenId: TokenId): boolean {
  return tokenId.startsWith("tone:");
}

function slotId(entryIndex: number, syllableIndex: number, tokenIndex: number): string {
  return `${entryIndex}:${syllableIndex}:${tokenIndex}`;
}

function compileSyllable(
  exercise: Exercise,
  entryIndex: number,
  syllableIndex: number,
  ordinal: number,
): SyllableInputPlan {
  const entry = exercise.entries[entryIndex];
  if (entry === undefined) throw new Error(`missing exercise entry at index ${entryIndex}`);
  const syllable = entry.syllables[syllableIndex];
  if (syllable === undefined) {
    throw new Error(`missing syllable ${entry.id}[${syllableIndex}]`);
  }
  if (syllable.tokens.length < 2) {
    throw new Error(`syllable ${entry.id}[${syllableIndex}] must contain body and tone tokens`);
  }

  const toneIndex = syllable.tokens.length - 1;
  const toneToken = syllable.tokens[toneIndex]!;
  if (!isToneToken(toneToken)) {
    throw new Error(`syllable ${entry.id}[${syllableIndex}] must end with a tone token`);
  }
  if (syllable.tokens.slice(0, toneIndex).some(isToneToken)) {
    throw new Error(`syllable ${entry.id}[${syllableIndex}] contains a non-final tone token`);
  }

  const bodySlots = syllable.tokens.slice(0, toneIndex).map((tokenId, tokenIndex): InputSlot => ({
    id: slotId(entryIndex, syllableIndex, tokenIndex),
    tokenId,
    canonicalTokenIndex: tokenIndex,
    kind: "body",
  }));
  const toneSlot: InputSlot = {
    id: slotId(entryIndex, syllableIndex, toneIndex),
    tokenId: toneToken,
    canonicalTokenIndex: toneIndex,
    kind: "tone",
  };

  return {
    id: `${entryIndex}:${syllableIndex}`,
    ordinal,
    entryId: entry.id,
    entryIndex,
    syllableIndex,
    bodySlots,
    toneSlot,
  };
}

/**
 * Compiles canonical catalog readings into an interaction plan.
 *
 * The catalog order is preserved as metadata only. The plan deliberately separates
 * the unordered phonetic body from the final tone commit so interaction code does
 * not need to treat canonical token order as an input cursor.
 */
export function compileExerciseInputPlan(exercise: Exercise): ExerciseInputPlan {
  const syllables: SyllableInputPlan[] = [];

  exercise.entries.forEach((entry, entryIndex) => {
    entry.syllables.forEach((_syllable, syllableIndex) => {
      syllables.push(compileSyllable(exercise, entryIndex, syllableIndex, syllables.length));
    });
  });

  return {
    exerciseId: exercise.id,
    syllables,
    totalSlots: syllables.reduce(
      (total, syllable) => total + syllable.bodySlots.length + 1,
      0,
    ),
  };
}
