from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} anchor, found {count}")
    text = text.replace(old, new, 1)

once(
'''  bounds: DerivationBounds,
  inputState: State,
  path: SamplingPathNode,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
'''  bounds: DerivationBounds,
  inputState: State,
  pathParent: SamplingPathNode,
  pathSegment: string,
  isLexicalSlotReachable: ((slot: StructuralLexicalSlot) => boolean) | undefined,
''',
"sampleRuleChildren path parameters",
)

once(
'''): SampledRuleChildren | null {
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
''',
'''): SampledRuleChildren | null {
  let candidatePath: SamplingPathNode | undefined;
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
''',
"candidate path local",
)

once(
'''        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(path, constituent.key),
        );
''',
'''        candidatePath ??= extendSamplingPath(pathParent, pathSegment);
        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(candidatePath, constituent.key),
        );
''',
"lexical candidate path",
)

once(
'''      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
        constituent.category,
        childRequirements,
        rulesByOutput,
        orderedConstituentsBySurfaceOrder,
        random,
        bounds,
        workingState,
        extendSamplingPath(path, `${constituent.key}[${occurrenceIndex}]`),
''',
'''      const requestedChildRuleId = target?.childRuleId;
      candidatePath ??= extendSamplingPath(pathParent, pathSegment);
      const child = sampleCategory(
        constituent.category,
        childRequirements,
        rulesByOutput,
        orderedConstituentsBySurfaceOrder,
        random,
        bounds,
        workingState,
        extendSamplingPath(candidatePath, `${constituent.key}[${occurrenceIndex}]`),
''',
"recursive candidate path",
)

once(
'''      bounds,
      state,
      extendSamplingPath(path, rule.id),
      isLexicalSlotReachable,
''',
'''      bounds,
      state,
      path,
      rule.id,
      isLexicalSlotReachable,
''',
"sampleRuleChildren call",
)

path.write_text(text)
