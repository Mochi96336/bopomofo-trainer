import type {
  ProductionConstituent,
  SyntacticFunction,
  SyntaxFeatureSet,
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
  return {
    requiredFunctions,
    requiredValencyFrames,
    requiredFeatures: constituent.requiredFeatures,
  };
}
