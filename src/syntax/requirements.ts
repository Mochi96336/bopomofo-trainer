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

const preparedLocalRequirements = new WeakMap<ProductionConstituent, SyntaxRequirements>();

function localRequirementsForConstituent(
  constituent: ProductionConstituent,
): SyntaxRequirements {
  const cached = preparedLocalRequirements.get(constituent);
  if (cached !== undefined) return cached;

  const prepared: SyntaxRequirements = {
    requiredFunctions: mergeFunctions(constituent.requiredFunctions, []),
    requiredValencyFrames: [...constituent.requiredValencyFrames].sort(compareText),
    requiredOccurrenceCapabilities: mergeOccurrenceCapabilities(
      constituent.requiredOccurrenceCapabilities ?? [],
      [],
    ),
    requiredFeatures: Object.fromEntries(featureEntries(constituent.requiredFeatures)),
  };
  preparedLocalRequirements.set(constituent, prepared);
  return prepared;
}

function copyRequirements(requirements: SyntaxRequirements): SyntaxRequirements {
  return {
    requiredFunctions: [...requirements.requiredFunctions],
    requiredValencyFrames: [...requirements.requiredValencyFrames],
    requiredOccurrenceCapabilities: [...requirements.requiredOccurrenceCapabilities],
    requiredFeatures: { ...requirements.requiredFeatures },
  };
}

export function requirementsForConstituent(
  constituent: ProductionConstituent,
  parent: SyntaxRequirementsInput,
): SyntaxRequirements | null {
  const local = localRequirementsForConstituent(constituent);
  const inheritFunctions = constituent.inheritFunctions === true && parent.requiredFunctions.length > 0;
  const inheritValencyFrames = constituent.inheritValencyFrames === true
    && parent.requiredValencyFrames.length > 0;
  const inheritedOccurrenceCapabilities = parent.requiredOccurrenceCapabilities ?? [];
  const inheritOccurrenceCapabilities = constituent.inheritOccurrenceCapabilities === true
    && inheritedOccurrenceCapabilities.length > 0;
  const inheritFeatures = constituent.inheritFeatures === true
    && Object.keys(parent.requiredFeatures).length > 0;

  if (
    !inheritFunctions
    && !inheritValencyFrames
    && !inheritOccurrenceCapabilities
    && !inheritFeatures
  ) {
    return copyRequirements(local);
  }

  const requiredFunctions = mergeFunctions(
    local.requiredFunctions,
    inheritFunctions ? parent.requiredFunctions : [],
  );
  const requiredValencyFrames = mergeValencyFrames(
    local.requiredValencyFrames,
    inheritValencyFrames ? parent.requiredValencyFrames : [],
  );
  if (requiredValencyFrames === null) return null;
  const requiredOccurrenceCapabilities = mergeOccurrenceCapabilities(
    local.requiredOccurrenceCapabilities,
    inheritOccurrenceCapabilities ? inheritedOccurrenceCapabilities : [],
  );
  const requiredFeatures = mergeFeatures(
    local.requiredFeatures,
    inheritFeatures ? parent.requiredFeatures : {},
  );
  if (requiredFeatures === null) return null;
  return {
    requiredFunctions,
    requiredValencyFrames,
    requiredOccurrenceCapabilities,
    requiredFeatures,
  };
}
