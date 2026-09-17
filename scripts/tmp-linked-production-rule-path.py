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

interface ProductionRulePathNode {
  readonly ruleId: string;
  next: ProductionRulePathNode | null;
}

function materializeProductionRulePath(head: ProductionRulePathNode): readonly string[] {
  const ruleIds: string[] = [];
  for (let node: ProductionRulePathNode | null = head; node !== null; node = node.next) {
    ruleIds.push(node.ruleId);
  }
  return ruleIds;
}

function productionRulePathIncludes(head: ProductionRulePathNode, ruleId: string): boolean {
  for (let node: ProductionRulePathNode | null = head; node !== null; node = node.next) {
    if (node.ruleId === ruleId) return true;
  }
  return false;
}

interface Sampled {
  readonly element: PendingStructuralElement;
  readonly state: State;
  readonly rulePathHead: ProductionRulePathNode;
  readonly rulePathTail: ProductionRulePathNode;
  readonly slots: readonly StructuralLexicalSlot[];
  readonly slotContexts: readonly SampledLexicalSlotContext[];
}

interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly PendingStructuralElement[];
  readonly rulePathHead: ProductionRulePathNode | null;
  readonly rulePathTail: ProductionRulePathNode | null;
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
  let rulePathHead: ProductionRulePathNode | null = null;
  let rulePathTail: ProductionRulePathNode | null = null;
''',
"children rule path accumulators",
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
      if (rulePathTail === null) {
        rulePathHead = child.rulePathHead;
      } else {
        rulePathTail.next = child.rulePathHead;
      }
      rulePathTail = child.rulePathTail;
      workingState = child.state;
''',
"child rule path append",
)

once(
'''    children,
    rulePath,
    slots,
''',
'''    children,
    rulePathHead,
    rulePathTail,
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
'''    const rulePathHead: ProductionRulePathNode = {
      ruleId: rule.id,
      next: sampledChildren.rulePathHead,
    };
    return {
      element: node,
      state: sampledChildren.state,
      rulePathHead,
      rulePathTail: sampledChildren.rulePathTail ?? rulePathHead,
      slots: sampledChildren.slots,
      slotContexts: sampledChildren.slotContexts,
    };
''',
"category rule path prepend",
)

once(
'''    if (requiredProductionRuleIdsAnyOf !== undefined
      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) continue;
    const materializedRoot = materializePendingElement(sampled.element);
''',
'''    if (requiredProductionRuleIdsAnyOf !== undefined
      && !requiredProductionRuleIdsAnyOf.some((ruleId) =>
        productionRulePathIncludes(sampled.rulePathHead, ruleId),
      )) continue;
    const productionRulePath = materializeProductionRulePath(sampled.rulePathHead);
    const materializedRoot = materializePendingElement(sampled.element);
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

if "sampled.rulePath" in text or "child.rulePath" in text:
    raise SystemExit("array rulePath consumer remains")

path.write_text(text)
