import type { CatalogCommonnessBase, CatalogEntry, Syllable } from "../core/model.js";
import {
  SYNTACTIC_FUNCTIONS,
  UPOS_VALUES,
  VALENCY_FRAMES,
  type RuntimeSyntaxProfile,
} from "../syntax/types.js";

const EMPTY_STRINGS: readonly string[] = [];
const EMPTY_NUMBERS: readonly number[] = [];
const EMPTY_COUNTS: Readonly<Record<string, number>> = {};

export type EncodedCatalogEntry = readonly [
  text: string,
  syllableTokens: readonly (readonly string[])[],
  selectionWeight: number | null,
];

/**
 * Compact syntax-profile wire tuple. Morphology is an optional trailing field
 * so pre-morphology 6-tuples remain byte- and decoder-compatible.
 */
export type EncodedSyntaxProfile = readonly [
  entryIndex: number,
  uposIndex: number,
  functionIndices: readonly number[],
  valencyFrameIndices: readonly number[],
  relationKeyIndices: readonly number[],
  positionKeyIndices: readonly number[],
  morphologyKeyIndices?: readonly number[],
];

export interface DependencyKeyTables {
  readonly relationKeys: readonly string[];
  readonly positionKeys: readonly string[];
  readonly morphologyKeys: readonly string[];
}

export interface EncodedSyntaxProfiles extends DependencyKeyTables {
  readonly profiles: readonly EncodedSyntaxProfile[];
}

/**
 * Reproduces the `word:{text}:{reading}` identity assigned at
 * src/catalog/compile-catalog.ts:191, but derived from parsed syllable
 * tokens instead of the raw CSV reading string, since only tokens survive
 * into the compact wire format. Must keep producing byte-identical output
 * for unchanged words: this id is persisted in localStorage progress.
 */
export function catalogEntryId(text: string, syllables: readonly Syllable[]): string {
  const reading = syllables
    .map((syllable) => syllable.tokens.map((token) => token.slice(token.indexOf(":") + 1)).join(""))
    .join("-");
  return `word:${text}:${reading}`;
}

function placeholderCommonnessBase(selectionWeight: number): CatalogCommonnessBase {
  return {
    modelVersion: "compacted",
    sourceId: "compacted",
    sourceVersion: "compacted",
    sourceRowId: "compacted",
    spokenPerMillion: null,
    writtenPerMillion: null,
    spokenStrength: null,
    writtenStrength: null,
    score: selectionWeight,
    selectionWeight,
    confidence: "reviewed",
    reasons: EMPTY_STRINGS,
  };
}

export function encodeCatalogEntry(entry: CatalogEntry): EncodedCatalogEntry {
  return [
    entry.prompt.text,
    entry.syllables.map((syllable) => syllable.tokens),
    entry.commonnessBase?.selectionWeight ?? null,
  ];
}

export function decodeCatalogEntry(encoded: EncodedCatalogEntry): CatalogEntry {
  const [text, syllableTokens, selectionWeight] = encoded;
  const syllables: readonly Syllable[] = syllableTokens.map((tokens) => ({ tokens }));
  return {
    id: catalogEntryId(text, syllables),
    prompt: { text, locale: "zh-TW" },
    syllables,
    tags: EMPTY_STRINGS,
    provenanceIds: EMPTY_STRINGS,
    ...(selectionWeight === null ? {} : { commonnessBase: placeholderCommonnessBase(selectionWeight) }),
  };
}

export function encodeCatalogEntries(entries: readonly CatalogEntry[]): readonly EncodedCatalogEntry[] {
  return entries.map(encodeCatalogEntry);
}

export function decodeCatalogEntries(
  encoded: readonly EncodedCatalogEntry[],
): readonly CatalogEntry[] {
  return encoded.map(decodeCatalogEntry);
}

/**
 * Runtime feature matching reads only presence (`count > 0`), never magnitude,
 * of dependency relations, surface positions, or reviewed morphology. Counts
 * therefore collapse to present/absent key sets in the compact wire format.
 */
export function deriveDependencyKeyTables(
  profiles: readonly RuntimeSyntaxProfile[],
): DependencyKeyTables {
  const relationKeys = new Set<string>();
  const positionKeys = new Set<string>();
  const morphologyKeys = new Set<string>();
  for (const profile of profiles) {
    for (const [key, count] of Object.entries(profile.dependencyEvidence.dependencyRelationCounts)) {
      if (count > 0) relationKeys.add(key);
    }
    for (const [key, count] of Object.entries(profile.dependencyEvidence.surfacePositionCounts)) {
      if (count > 0) positionKeys.add(key);
    }
    for (const [key, count] of Object.entries(
      profile.dependencyEvidence.morphologicalFeatureCounts ?? EMPTY_COUNTS,
    )) {
      if (count > 0) morphologyKeys.add(key);
    }
  }
  return {
    relationKeys: [...relationKeys].sort(),
    positionKeys: [...positionKeys].sort(),
    morphologyKeys: [...morphologyKeys].sort(),
  };
}

function indexOrThrow(table: ReadonlyMap<string, number>, key: string, label: string): number {
  const index = table.get(key);
  if (index === undefined) throw new Error(`unknown ${label} "${key}"`);
  return index;
}

function presentIndices(
  counts: Readonly<Record<string, number>>,
  table: ReadonlyMap<string, number>,
): readonly number[] {
  const indices: number[] = [];
  for (const [key, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    indices.push(indexOrThrow(table, key, "evidence key"));
  }
  return indices.sort((left, right) => left - right);
}

export function encodeSyntaxProfiles(
  profiles: readonly RuntimeSyntaxProfile[],
  allEntries: readonly CatalogEntry[],
): EncodedSyntaxProfiles {
  const { relationKeys, positionKeys, morphologyKeys } = deriveDependencyKeyTables(profiles);
  const relationIndex = new Map(relationKeys.map((key, index) => [key, index]));
  const positionIndex = new Map(positionKeys.map((key, index) => [key, index]));
  const morphologyIndex = new Map(morphologyKeys.map((key, index) => [key, index]));
  const entryIndex = new Map(allEntries.map((entry, index) => [entry.id, index]));
  const uposIndex = new Map(UPOS_VALUES.map((value, index): [string, number] => [value, index]));
  const functionIndex = new Map(SYNTACTIC_FUNCTIONS.map((value, index): [string, number] => [value, index]));
  const valencyIndex = new Map(VALENCY_FRAMES.map((value, index): [string, number] => [value, index]));

  const encoded = profiles.map((profile): EncodedSyntaxProfile => {
    const entryPosition = indexOrThrow(entryIndex, profile.entryId, "catalog entry");
    const uposPosition = indexOrThrow(uposIndex, profile.upos, "upos");
    const morphologyIndices = presentIndices(
      profile.dependencyEvidence.morphologicalFeatureCounts ?? EMPTY_COUNTS,
      morphologyIndex,
    );
    const base = [
      entryPosition,
      uposPosition,
      profile.functions.map((value) => indexOrThrow(functionIndex, value, "syntactic function")),
      profile.valencyFrames.map((value) => indexOrThrow(valencyIndex, value, "valency frame")),
      presentIndices(profile.dependencyEvidence.dependencyRelationCounts, relationIndex),
      presentIndices(profile.dependencyEvidence.surfacePositionCounts, positionIndex),
    ] as const;
    return morphologyIndices.length === 0 ? base : [...base, morphologyIndices] as const;
  });

  return { relationKeys, positionKeys, morphologyKeys, profiles: encoded };
}

function enumOrThrow<T extends string>(table: readonly T[], index: number, label: string): T {
  const value = table[index];
  if (value === undefined) throw new Error(`${label} index ${index} out of range`);
  return value;
}

function decodeEvidenceCounts(
  indices: readonly number[],
  table: readonly string[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const index of indices) {
    counts[enumOrThrow(table, index, "evidence key")] = 1;
  }
  return counts;
}

export function decodeSyntaxProfiles(
  encoded: readonly EncodedSyntaxProfile[],
  allEntries: readonly CatalogEntry[],
  relationKeys: readonly string[],
  positionKeys: readonly string[],
  morphologyKeys: readonly string[] = EMPTY_STRINGS,
): readonly RuntimeSyntaxProfile[] {
  return encoded.map((profile, position): RuntimeSyntaxProfile => {
    const [
      entryIndex,
      uposIndex,
      functionIndices,
      valencyFrameIndices,
      relationIndices,
      positionIndices,
      morphologyIndices = EMPTY_NUMBERS,
    ] = profile;
    const entry = allEntries[entryIndex];
    if (entry === undefined) throw new Error(`catalog entry index ${entryIndex} out of range`);
    return {
      id: `runtime-syntax-profile:${position}`,
      entryId: entry.id,
      upos: enumOrThrow(UPOS_VALUES, uposIndex, "upos"),
      functions: functionIndices.map((index) => enumOrThrow(SYNTACTIC_FUNCTIONS, index, "syntactic function")),
      valencyFrames: valencyFrameIndices.map((index) => enumOrThrow(VALENCY_FRAMES, index, "valency frame")),
      dependencyEvidence: {
        dependencyRelationCounts: decodeEvidenceCounts(relationIndices, relationKeys),
        surfacePositionCounts: decodeEvidenceCounts(positionIndices, positionKeys),
        morphologicalFeatureCounts: decodeEvidenceCounts(morphologyIndices, morphologyKeys),
      },
      provenanceIds: EMPTY_STRINGS,
    };
  });
}
