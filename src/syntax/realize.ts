import type { CatalogEntry } from "../core/model.js";
import { stableRuntimeDigest } from "../core/stable-id.js";
import type { StructuralDerivationShape, StructuralLexicalSlot } from "./derive.js";
import { syntaxProfileMatchesRequirements } from "./profile-match.js";
import type {
  RuntimeSyntaxProfile,
  SurfaceRealization,
  SurfaceToken,
} from "./types.js";

export interface LexicalRealizationOptions {
  readonly entries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly seed?: string;
  readonly profileOffsetsBySlotId?: Readonly<Record<string, number>>;
  readonly punctuationToken?: string;
}

export interface LexicalProfileIndex {
  readonly profilesByUpos: Readonly<Record<string, readonly RuntimeSyntaxProfile[]>>;
  readonly entriesById: ReadonlyMap<string, CatalogEntry>;
}

export interface IndexedLexicalRealizationOptions {
  readonly index: LexicalProfileIndex;
  readonly seed?: string;
  readonly profileOffsetsBySlotId?: Readonly<Record<string, number>>;
  readonly punctuationToken?: string;
}

const compatibleProfilesCache = new WeakMap<
  LexicalProfileIndex,
  Map<string, readonly RuntimeSyntaxProfile[]>
>();

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compatibilityCacheKey(slot: StructuralLexicalSlot): string {
  const key: unknown[] = [];
  if (slot.formalLiteral === undefined) {
    key.push(0);
  } else {
    key.push(1, slot.formalLiteral);
  }
  key.push(slot.allowedUpos.length, ...slot.allowedUpos);
  key.push(slot.requiredFunctions.length, ...slot.requiredFunctions);
  key.push(slot.requiredValencyFrames.length, ...slot.requiredValencyFrames);
  const occurrenceCapabilities = slot.requiredOccurrenceCapabilities ?? [];
  key.push(occurrenceCapabilities.length, ...occurrenceCapabilities);

  const featureEntries = Object.entries(slot.requiredFeatures);
  if (featureEntries.length > 1) {
    featureEntries.sort(([left], [right]) => compareText(left, right));
  }
  key.push(featureEntries.length);
  for (const [feature, value] of featureEntries) {
    key.push(feature, value === undefined ? 0 : 1);
    if (value !== undefined) key.push(value);
  }
  return JSON.stringify(key);
}

export function buildLexicalProfileIndex(
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
): LexicalProfileIndex {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const grouped: Record<string, RuntimeSyntaxProfile[]> = {};
  for (const profile of [...profiles].sort((left, right) => compareText(left.id, right.id))) {
    if (!entriesById.has(profile.entryId)) {
      throw new Error(`syntax profile references missing catalog entry ${profile.entryId}`);
    }
    (grouped[profile.upos] ??= []).push(profile);
  }
  return { profilesByUpos: grouped, entriesById };
}

export function compatibleProfilesForSlot(
  slot: StructuralLexicalSlot,
  index: LexicalProfileIndex,
): readonly RuntimeSyntaxProfile[] {
  let byRequirements = compatibleProfilesCache.get(index);
  if (byRequirements === undefined) {
    byRequirements = new Map<string, readonly RuntimeSyntaxProfile[]>();
    compatibleProfilesCache.set(index, byRequirements);
  }
  const cacheKey = compatibilityCacheKey(slot);
  const cached = byRequirements.get(cacheKey);
  if (cached !== undefined) return cached;

  if (slot.formalLiteral !== undefined) {
    const compatible: readonly RuntimeSyntaxProfile[] = [];
    byRequirements.set(cacheKey, compatible);
    return compatible;
  }
  const candidates = slot.allowedUpos.length === 0
    ? Object.values(index.profilesByUpos).flat()
    : slot.allowedUpos.flatMap((upos) => index.profilesByUpos[upos] ?? []);
  const compatible = candidates.filter((profile) => {
    const entry = index.entriesById.get(profile.entryId);
    return entry !== undefined
      && syntaxProfileMatchesRequirements(profile, slot, entry.prompt.text);
  });
  byRequirements.set(cacheKey, compatible);
  return compatible;
}

function seededOffset(seed: string, slotId: string, size: number): number {
  const digest = stableRuntimeDigest({ seed, slotId });
  const prefix = digest.slice(0, 12);
  return Number.parseInt(prefix, 16) % size;
}

function normalizeOffset(value: number, size: number): number {
  if (!Number.isInteger(value)) throw new Error("profile offsets must be integers");
  return ((value % size) + size) % size;
}

export function realizeStructuralDerivationWithIndex(
  shape: StructuralDerivationShape,
  options: IndexedLexicalRealizationOptions,
): SurfaceRealization | null {
  const { index } = options;
  const seed = options.seed ?? shape.id;
  const tokens: SurfaceToken[] = [];
  const entryIds: string[] = [];
  const syntaxProfileIds: string[] = [];
  for (const slot of shape.lexicalSlots) {
    if (slot.formalLiteral !== undefined) {
      tokens.push({
        kind: "punctuation",
        value: slot.formalLiteral,
        entryId: null,
        syntaxProfileId: null,
      });
      continue;
    }
    const punctuationOnly = slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT";
    const compatible = compatibleProfilesForSlot(slot, index);
    if (compatible.length === 0 && punctuationOnly) {
      tokens.push({
        kind: "punctuation",
        value: options.punctuationToken ?? "。",
        entryId: null,
        syntaxProfileId: null,
      });
      continue;
    }
    if (compatible.length === 0) return null;
    const requested = options.profileOffsetsBySlotId?.[slot.id];
    const offset = requested === undefined
      ? seededOffset(seed, slot.id, compatible.length)
      : normalizeOffset(requested, compatible.length);
    const profile = compatible[offset];
    if (profile === undefined) throw new Error("compatible profile selection failed");
    const entry = index.entriesById.get(profile.entryId);
    if (entry === undefined) throw new Error(`missing catalog entry ${profile.entryId}`);
    entryIds.push(entry.id);
    syntaxProfileIds.push(profile.id);
    tokens.push({
      kind: "lexical-entry",
      value: entry.prompt.text,
      entryId: entry.id,
      syntaxProfileId: profile.id,
    });
  }
  const identity = {
    grammarVersion: shape.grammarVersion,
    derivationId: shape.id,
    productionRulePath: shape.productionRulePath,
    entryIds,
    syntaxProfileIds,
    tokens,
  };
  return {
    id: `surface-realization:${stableRuntimeDigest(identity)}`,
    grammarVersion: shape.grammarVersion,
    derivationId: shape.id,
    productionRulePath: shape.productionRulePath,
    entryIds,
    syntaxProfileIds,
    tokens,
  };
}

export function realizeStructuralDerivation(
  shape: StructuralDerivationShape,
  options: LexicalRealizationOptions,
): SurfaceRealization | null {
  const index = buildLexicalProfileIndex(options.entries, options.profiles);
  return realizeStructuralDerivationWithIndex(shape, {
    index,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    ...(options.profileOffsetsBySlotId === undefined
      ? {}
      : { profileOffsetsBySlotId: options.profileOffsetsBySlotId }),
    ...(options.punctuationToken === undefined
      ? {}
      : { punctuationToken: options.punctuationToken }),
  });
}
