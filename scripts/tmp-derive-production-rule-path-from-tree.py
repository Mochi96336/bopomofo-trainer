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
'''type PendingStructuralElement = StructuralLexicalSlot | PendingSyntaxNode;

interface Sampled {
  readonly element: PendingStructuralElement;
  readonly state: State;
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}

interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly PendingStructuralElement[];
  readonly rulePath: readonly string[];
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}
''',
'''type PendingStructuralElement = StructuralLexicalSlot | PendingSyntaxNode;

function pendingSyntaxTreeIncludesProductionRule(
  root: PendingSyntaxNode,
  ruleId: string,
): boolean {
  const stack: PendingSyntaxNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.productionRuleId === ruleId) return true;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child?.kind === "syntax-node") stack.push(child);
    }
  }
  return false;
}

function materializeProductionRulePath(root: PendingSyntaxNode): readonly string[] {
  const ruleIds: string[] = [];
  const stack: PendingSyntaxNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    ruleIds.push(node.productionRuleId);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child?.kind === "syntax-node") stack.push(child);
    }
  }
  return ruleIds;
}

interface Sampled {
  readonly element: PendingStructuralElement;
  readonly state: State;
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}

interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly PendingStructuralElement[];
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}
''',
"rule path types",
)

once(
'''  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
  const rulePath: string[] = [];
''',
'''  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
''',
"children rule path accumulator",
)

once(
'''      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      rulePath.push(...child.rulePath);
      workingState = child.state;
''',
'''      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      workingState = child.state;
''',
"child rule path copy",
)

once(
'''    children,
    rulePath,
    slots,
''',
'''    children,
    slots,
''',
"children return path",
)

once(
'''    return {
      element: node,
      state: sampledChildren.state,
      rulePath: [rule.id, ...sampledChildren.rulePath],
      slots: sampledChildren.slots,
      slotContexts: sampledChildren.slotContexts,
    };
''',
'''    return {
      element: node,
      state: sampledChildren.state,
      slots: sampledChildren.slots,
      slotContexts: sampledChildren.slotContexts,
    };
''',
"category rule path",
)

once(
'''    if (sampled === null || sampled.element.kind !== "syntax-node") continue;
    const requiredLexicalSlot = options.requiredLexicalSlot;
''',
'''    if (sampled === null || sampled.element.kind !== "syntax-node") continue;
    const root = sampled.element;
    const requiredLexicalSlot = options.requiredLexicalSlot;
''',
"root alias",
)

once(
'''    if (requiredProductionRuleIdsAnyOf !== undefined
      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) continue;
    const materializedRoot = materializePendingElement(sampled.element);
''',
'''    if (requiredProductionRuleIdsAnyOf !== undefined
      && !requiredProductionRuleIdsAnyOf.some((ruleId) =>
        pendingSyntaxTreeIncludesProductionRule(root, ruleId),
      )) continue;
    const productionRulePath = materializeProductionRulePath(root);
    const materializedRoot = materializePendingElement(root);
''',
"root rule path consumers",
)

once(
'''      materializedRoot.canonicalSource,
      sampled.rulePath,
    );
''',
'''      materializedRoot.canonicalSource,
      productionRulePath,
    );
''',
"identity rule path",
)

once(
'''      root: materializedRoot.element,
      productionRulePath: sampled.rulePath,
      lexicalSlots: sampled.slots,
''',
'''      root: materializedRoot.element,
      productionRulePath,
      lexicalSlots: sampled.slots,
''',
"public rule path",
)

for stale in (
    "rulePath.push(...child.rulePath)",
    "[rule.id, ...sampledChildren.rulePath]",
    "sampled.rulePath.includes(",
    "productionRulePath: sampled.rulePath",
):
    if stale in text:
        raise SystemExit(f"array rulePath consumer remains: {stale}")

path.write_text(text)
