from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

replacements = [
    (
'''function bindingId(constituent: ProductionConstituent, path: readonly string[]): string | undefined {
  if (constituent.entryBinding === undefined) return undefined;
  return `${path.slice(0, -1).join("/")}:${constituent.entryBinding}`;
}
''',
'''interface SamplingPathNode {
  readonly parent: SamplingPathNode | null;
  readonly segment: string;
}

function extendSamplingPath(
  parent: SamplingPathNode | null,
  segment: string,
): SamplingPathNode {
  return { parent, segment };
}

function materializeSamplingPath(path: SamplingPathNode): readonly string[] {
  const segments: string[] = [];
  for (let current: SamplingPathNode | null = path; current !== null; current = current.parent) {
    segments.push(current.segment);
  }
  segments.reverse();
  return segments;
}

function bindingId(constituent: ProductionConstituent, path: SamplingPathNode): string | undefined {
  if (constituent.entryBinding === undefined) return undefined;
  const parentPath = path.parent;
  return `${parentPath === null ? "" : materializeSamplingPath(parentPath).join("/")}:${constituent.entryBinding}`;
}
''',
"linked path helpers",
    ),
    (
'''function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
): StructuralLexicalSlot {
''',
'''function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: SamplingPathNode,
): StructuralLexicalSlot {
''',
"makeSlot path type",
    ),
    (
'''        occurrenceIndex,
        path,
        entryBindingId,
''',
'''        occurrenceIndex,
        materializeSamplingPath(path),
        entryBindingId,
''',
"lazy slot path materialization",
    ),
    (
'''function sampleRuleChildren(
  parentRuleId: string,
  ordered: readonly ProductionConstituent[],
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: readonly string[],
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
'''function sampleRuleChildren(
  parentRuleId: string,
  ordered: readonly ProductionConstituent[],
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: SamplingPathNode,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
"sampleRuleChildren path type",
    ),
    (
'''          [...path, constituent.key],
''',
'''          extendSamplingPath(path, constituent.key),
''',
"lexical path extension",
    ),
    (
'''        [...path, `${constituent.key}[${occurrenceIndex}]`],
''',
'''        extendSamplingPath(path, `${constituent.key}[${occurrenceIndex}]`),
''',
"recursive path extension",
    ),
    (
'''function sampleCategory(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: readonly string[],
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
'''function sampleCategory(
  category: SyntaxCategory,
  requirements: SyntaxRequirements,
  rulesByOutput: ReadonlyMap<SyntaxCategory, readonly ProductionRule[]>,
  orderedConstituentsBySurfaceOrder: ReadonlyMap<SurfaceOrder, readonly ProductionConstituent[]>,
  random: RandomSource,
  bounds: DerivationBounds,
  inputState: State,
  path: SamplingPathNode,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
"sampleCategory path type",
    ),
    (
'''      [...path, rule.id],
''',
'''      extendSamplingPath(path, rule.id),
''',
"rule path extension",
    ),
    (
'''      [options.rootCategory],
''',
'''      extendSamplingPath(null, options.rootCategory),
''',
"root path node",
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} snippet, found {count}")
    text = text.replace(old, new, 1)

if "[...path," in text:
    raise SystemExit("sampling-path array spread remains")

path.write_text(text)
