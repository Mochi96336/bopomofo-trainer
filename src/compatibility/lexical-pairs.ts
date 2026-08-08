import { sha256Canonical } from "../reference/importers/canonical-json.js";

export interface SurfacePairEvidence {
  readonly leftText: string;
  readonly rightText: string;
  readonly count: number;
  readonly score: number;
}

export interface DependencyPairEvidence {
  readonly headText: string;
  readonly dependentText: string;
  readonly relation: string;
  readonly count: number;
  readonly score: number;
}

export interface LexicalCompatibilityArtifact {
  readonly adapterVersion: string;
  readonly schemaVersion: "ud-lexical-compatibility-v1";
  readonly source: unknown;
  readonly candidateSource?: unknown;
  readonly candidateCount: number;
  readonly minimumPairCount: number;
  readonly surfaceObservationCount: number;
  readonly dependencyObservationCount: number;
  readonly surfacePairs: readonly SurfacePairEvidence[];
  readonly dependencyPairs: readonly DependencyPairEvidence[];
  readonly determinismDigest: string;
}

export interface LexicalCompatibilityIndex {
  readonly surfaceScoreByPair: ReadonlyMap<string, number>;
  readonly dependencyScoreByPair: ReadonlyMap<string, number>;
}

function pairKey(left: string, right: string): string {
  return JSON.stringify([left, right]);
}

function dependencyPairKey(head: string, dependent: string, relation: string): string {
  return JSON.stringify([head, dependent, relation]);
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateSurfacePair(
  pair: SurfacePairEvidence,
  minimumPairCount: number,
): void {
  if (!pair.leftText || !pair.rightText
    || !validCount(pair.count) || pair.count < minimumPairCount
    || !validScore(pair.score)) {
    throw new Error("lexical compatibility artifact contains an invalid surface pair");
  }
}

function validateDependencyPair(
  pair: DependencyPairEvidence,
  minimumPairCount: number,
): void {
  if (!pair.headText || !pair.dependentText || !pair.relation
    || !validCount(pair.count) || pair.count < minimumPairCount
    || !validScore(pair.score)) {
    throw new Error("lexical compatibility artifact contains an invalid dependency pair");
  }
}

export function buildLexicalCompatibilityIndex(
  artifact: LexicalCompatibilityArtifact,
): LexicalCompatibilityIndex {
  const { determinismDigest, ...core } = artifact;
  if (artifact.schemaVersion !== "ud-lexical-compatibility-v1"
    || !Number.isInteger(artifact.candidateCount) || artifact.candidateCount <= 0
    || !Number.isInteger(artifact.minimumPairCount) || artifact.minimumPairCount <= 0
    || !Number.isInteger(artifact.surfaceObservationCount) || artifact.surfaceObservationCount < 0
    || !Number.isInteger(artifact.dependencyObservationCount) || artifact.dependencyObservationCount < 0
    || determinismDigest !== sha256Canonical(core)) {
    throw new Error("lexical compatibility artifact is stale or invalid");
  }

  const surfaceScoreByPair = new Map<string, number>();
  for (const pair of artifact.surfacePairs) {
    validateSurfacePair(pair, artifact.minimumPairCount);
    const key = pairKey(pair.leftText, pair.rightText);
    if (surfaceScoreByPair.has(key)) {
      throw new Error("lexical compatibility artifact contains duplicate surface pairs");
    }
    surfaceScoreByPair.set(key, pair.score);
  }

  const dependencyScoreByPair = new Map<string, number>();
  for (const pair of artifact.dependencyPairs) {
    validateDependencyPair(pair, artifact.minimumPairCount);
    const key = dependencyPairKey(pair.headText, pair.dependentText, pair.relation);
    if (dependencyScoreByPair.has(key)) {
      throw new Error("lexical compatibility artifact contains duplicate dependency pairs");
    }
    dependencyScoreByPair.set(key, pair.score);
  }

  return { surfaceScoreByPair, dependencyScoreByPair };
}

export function surfaceCompatibilityScore(
  index: LexicalCompatibilityIndex,
  leftText: string,
  rightText: string,
): number {
  return index.surfaceScoreByPair.get(pairKey(leftText, rightText)) ?? 0;
}

export function dependencyCompatibilityScore(
  index: LexicalCompatibilityIndex,
  headText: string,
  dependentText: string,
  relation: string,
): number {
  return index.dependencyScoreByPair.get(
    dependencyPairKey(headText, dependentText, relation),
  ) ?? 0;
}

/**
 * Positive corpus evidence may boost a syntactically legal candidate, but lack
 * of evidence is neutral. This prevents a small treebank from becoming a hard
 * semantic allowlist.
 */
export function lexicalCompatibilityMultiplier(
  score: number,
  maximumBoost = 1,
): number {
  if (!validScore(score)) throw new Error("lexical compatibility score must be in [0, 1]");
  if (!Number.isFinite(maximumBoost) || maximumBoost < 0) {
    throw new Error("lexical compatibility maximum boost must be finite and non-negative");
  }
  return 1 + score * maximumBoost;
}
