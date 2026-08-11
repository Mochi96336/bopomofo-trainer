import type {
  ProductionConstituent,
  SyntacticFunction,
  SyntaxFeatureName,
  SyntaxFeatureSet,
  SyntaxFeatureValue,
  ValencyFrame,
} from "./types.js";

export interface SyntaxRequirements {
  readonly requiredFunctions: readonly SyntacticFunction[];
  readonly requiredValencyFrames: readonly ValencyFrame[];
  readonly requiredFeatures: SyntaxFeatureSet;
}

export const EMPTY_SYNTAX_REQUIREMENTS: SyntaxRequirements = {
  requiredFunctions: [],
  requiredValencyFrames: [],
  requiredFeatures: {},
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mergeFunctions(
  local: readonly SyntacticFunction[],
  inherited: readonly SyntacticFunction[],
): readonly SyntacticFunction[] {
  return [...new Set([...local, ...inherited])].sort(compareText);
}

function mergeValencyFrames(
  local: readonly ValencyFrame[],
  inherited: readonly ValencyFrame[],
): readonly ValencyFrame[] | null {
  if (local.length === 0) return [...inherited].sort(compareText);
  if (inherited.length === 0) return [...local].sort(compareText);
  const inheritedSet = new Set(inherited);
  const intersection = [...new Set(local.filter((value) => inheritedSet.has(value)))]
    .sort(compareText);
  return intersection.length > 0 ? intersection : null;
}

function featureEntries(
  features: SyntaxFeatureSet,
): readonly (readonly [SyntaxFeatureName, SyntaxFeatureValue])[] {
  return (Object.entries(features) as [SyntaxFeatureName, SyntaxFeatureValue][])
    .sort(([left], [right]) => compareText(left, right));
}

/**
 * Combine two feature requirement sets without widening either side. Distinct
 * features compose; the same feature at incompatible values fails closed.
 * Exported so derivation-time grammar views can reuse exactly the same feature
 * semantics as constituent inheritance.
 */
export function mergeSyntaxFeatureRequirements(
  local: SyntaxFeatureSet,
  added: SyntaxFeatureSet,
): SyntaxFeatureSet | null {
  const merged = new Map<SyntaxFeatureName, SyntaxFeatureValue>(featureEntries(added));
  for (const [feature, value] of featureEntries(local)) {
    const addedValue = merged.get(feature);
    if (addedValue !== undefined && addedValue !== value) return null;
    merged.set(feature, value);
  }
  return Object.fromEntries([...merged.entries()].sort(([left], [right]) => compareText(left, right)));
}

export function requirementsForConstituent(
  constituent: ProductionConstituent,
  parent: SyntaxRequirements,
): SyntaxRequirements | null {
  const requiredFunctions = mergeFunctions(
    constituent.requiredFunctions,
    constituent.inheritFunctions ? parent.requiredFunctions : [],
  );
  const requiredValencyFrames = mergeValencyFrames(
    constituent.requiredValencyFrames,
    constituent.inheritValencyFrames ? parent.requiredValencyFrames : [],
  );
  if (requiredValencyFrames === null) return null;
  const requiredFeatures = mergeSyntaxFeatureRequirements(
    constituent.requiredFeatures,
    constituent.inheritFeatures ? parent.requiredFeatures : {},
  );
  if (requiredFeatures === null) return null;
  return {
    requiredFunctions,
    requiredValencyFrames,
    requiredFeatures,
  };
}
