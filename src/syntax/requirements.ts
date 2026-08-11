import type {
  ProductionConstituent,
  RuntimeOccurrenceCapability,
  SyntacticFunction,
  SyntaxFeatureName,
  SyntaxFeatureSet,
  SyntaxFeatureValue,
  ValencyFrame,
} from "./types.js";

export interface SyntaxRequirements {
  readonly requiredFunctions: readonly SyntacticFunction[];
  readonly requiredValencyFrames: readonly ValencyFrame[];
  readonly requiredOccurrenceCapabilities: readonly RuntimeOccurrenceCapability[];
  readonly requiredFeatures: SyntaxFeatureSet;
}

/**
 * Compatibility input for callers that predate the same-occurrence requirement
 * dimension. Missing capability requirements mean none; every derived child
 * requirement is normalized back to the complete SyntaxRequirements shape.
 */
export type SyntaxRequirementsInput = Omit<SyntaxRequirements, "requiredOccurrenceCapabilities"> & {
  readonly requiredOccurrenceCapabilities?: readonly RuntimeOccurrenceCapability[];
};

export const EMPTY_SYNTAX_REQUIREMENTS: SyntaxRequirements = {
  requiredFunctions: [],
  requiredValencyFrames: [],
  requiredOccurrenceCapabilities: [],
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

function mergeOccurrenceCapabilities(
  local: readonly RuntimeOccurrenceCapability[],
  inherited: readonly RuntimeOccurrenceCapability[],
): readonly RuntimeOccurrenceCapability[] {
  return [...new Set([...local, ...inherited])].sort(compareText);
}

function featureEntries(
  features: SyntaxFeatureSet,
): readonly (readonly [SyntaxFeatureName, SyntaxFeatureValue])[] {
  return (Object.entries(features) as [SyntaxFeatureName, SyntaxFeatureValue][])
    .sort(([left], [right]) => compareText(left, right));
}

function mergeFeatures(
  local: SyntaxFeatureSet,
  inherited: SyntaxFeatureSet,
): SyntaxFeatureSet | null {
  const merged = new Map<SyntaxFeatureName, SyntaxFeatureValue>(featureEntries(inherited));
  for (const [feature, value] of featureEntries(local)) {
    const inheritedValue = merged.get(feature);
    if (inheritedValue !== undefined && inheritedValue !== value) return null;
    merged.set(feature, value);
  }
  return Object.fromEntries([...merged.entries()].sort(([left], [right]) => compareText(left, right)));
}

export function requirementsForConstituent(
  constituent: ProductionConstituent,
  parent: SyntaxRequirementsInput,
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
  const requiredOccurrenceCapabilities = mergeOccurrenceCapabilities(
    constituent.requiredOccurrenceCapabilities ?? [],
    constituent.inheritOccurrenceCapabilities ? parent.requiredOccurrenceCapabilities ?? [] : [],
  );
  const requiredFeatures = mergeFeatures(
    constituent.requiredFeatures,
    constituent.inheritFeatures ? parent.requiredFeatures : {},
  );
  if (requiredFeatures === null) return null;
  return {
    requiredFunctions,
    requiredValencyFrames,
    requiredOccurrenceCapabilities,
    requiredFeatures,
  };
}
