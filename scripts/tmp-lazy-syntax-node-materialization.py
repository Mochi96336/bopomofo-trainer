from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    text = text.replace(old, new, 1)

once(
'''interface Sampled {\n  readonly element: StructuralElement;\n  readonly canonicalSource: string;\n  readonly state: State;\n  readonly rulePath: readonly string[];\n  readonly slots: readonly StructuralLexicalSlot[];\n  readonly slotContexts: readonly SampledLexicalSlotContext[];\n}\n\ninterface SampledRuleChildren {\n  readonly state: State;\n  readonly children: readonly StructuralElement[];\n  readonly childCanonicalSources: readonly string[];\n  readonly rulePath: readonly string[];\n  readonly slots: readonly StructuralLexicalSlot[];\n  readonly slotContexts: readonly SampledLexicalSlotContext[];\n}\n''',
'''interface PendingSyntaxNode {\n  readonly kind: "syntax-node";\n  readonly category: SyntaxCategory;\n  readonly productionRuleId: string;\n  readonly surfaceOrderId: string;\n  readonly children: readonly PendingStructuralElement[];\n}\n\ntype PendingStructuralElement = StructuralLexicalSlot | PendingSyntaxNode;\n\ninterface Sampled {\n  readonly element: PendingStructuralElement;\n  readonly state: State;\n  readonly rulePath: readonly string[];\n  readonly slots: readonly StructuralLexicalSlot[];\n  readonly slotContexts: readonly SampledLexicalSlotContext[];\n}\n\ninterface SampledRuleChildren {\n  readonly state: State;\n  readonly children: readonly PendingStructuralElement[];\n  readonly rulePath: readonly string[];\n  readonly slots: readonly StructuralLexicalSlot[];\n  readonly slotContexts: readonly SampledLexicalSlotContext[];\n}\n''',
"pending interfaces",
)

once(
'''function derivationIdentityCanonicalJson(\n  rootCanonicalSource: string,\n  productionRulePath: readonly string[],\n): string {\n  return `{"grammarVersion":${JSON.stringify(FORMAL_GRAMMAR_VERSION)},"productionRulePath":${canonicalStringArrayJson(productionRulePath)},"root":${rootCanonicalSource}}`;\n}\n''',
'''interface MaterializedPendingElement {\n  readonly element: StructuralElement;\n  readonly canonicalSource: string;\n}\n\nfunction materializePendingElement(\n  pending: PendingStructuralElement,\n): MaterializedPendingElement {\n  if (pending.kind === "lexical-slot") {\n    return { element: pending, canonicalSource: lexicalSlotCanonicalJson(pending) };\n  }\n  const materializedChildren = pending.children.map(materializePendingElement);\n  const childCanonicalSources = materializedChildren.map((child) => child.canonicalSource);\n  const identitySource = syntaxNodeIdentityCanonicalJson(\n    pending.category,\n    pending.productionRuleId,\n    pending.surfaceOrderId,\n    childCanonicalSources,\n  );\n  const node: StructuralSyntaxNode = {\n    kind: "syntax-node",\n    id: `syntax-node:${stableRuntimeDigestCanonicalJson(identitySource)}`,\n    category: pending.category,\n    productionRuleId: pending.productionRuleId,\n    surfaceOrderId: pending.surfaceOrderId,\n    children: materializedChildren.map((child) => child.element),\n  };\n  return {\n    element: node,\n    canonicalSource: syntaxNodeCanonicalJson(node, childCanonicalSources),\n  };\n}\n\nfunction derivationIdentityCanonicalJson(\n  rootCanonicalSource: string,\n  productionRulePath: readonly string[],\n): string {\n  return `{"grammarVersion":${JSON.stringify(FORMAL_GRAMMAR_VERSION)},"productionRulePath":${canonicalStringArrayJson(productionRulePath)},"root":${rootCanonicalSource}}`;\n}\n''',
"materializer",
)

once(
'''  const children: StructuralElement[] = [];\n  const childCanonicalSources: string[] = [];\n''',
'''  const children: PendingStructuralElement[] = [];\n''',
"children storage",
)

once(
'''        children.push(slot);\n        childCanonicalSources.push(lexicalSlotCanonicalJson(slot));\n        slots.push(slot);\n''',
'''        children.push(slot);\n        slots.push(slot);\n''',
"slot canonical removal",
)

once(
'''      children.push(child.element);\n      childCanonicalSources.push(child.canonicalSource);\n      slots.push(...child.slots);\n''',
'''      children.push(child.element);\n      slots.push(...child.slots);\n''',
"child canonical removal",
)

once(
'''    children,\n    childCanonicalSources,\n    rulePath,\n''',
'''    children,\n    rulePath,\n''',
"children return",
)

once(
'''    const identitySource = syntaxNodeIdentityCanonicalJson(\n      category,\n      rule.id,\n      order.id,\n      sampledChildren.childCanonicalSources,\n    );\n    const node: StructuralSyntaxNode = {\n      kind: "syntax-node",\n      id: `syntax-node:${stableRuntimeDigestCanonicalJson(identitySource)}`,\n      category,\n      productionRuleId: rule.id,\n      surfaceOrderId: order.id,\n      children: sampledChildren.children,\n    };\n    return {\n      element: node,\n      canonicalSource: syntaxNodeCanonicalJson(node, sampledChildren.childCanonicalSources),\n      state: sampledChildren.state,\n''',
'''    const node: PendingSyntaxNode = {\n      kind: "syntax-node",\n      category,\n      productionRuleId: rule.id,\n      surfaceOrderId: order.id,\n      children: sampledChildren.children,\n    };\n    return {\n      element: node,\n      state: sampledChildren.state,\n''',
"defer node materialization",
)

once(
'''    const identitySource = derivationIdentityCanonicalJson(\n      sampled.canonicalSource,\n      sampled.rulePath,\n    );\n    return {\n      id: `derivation-shape:${stableRuntimeDigestCanonicalJson(identitySource)}`,\n      grammarVersion: FORMAL_GRAMMAR_VERSION,\n      root: sampled.element,\n''',
'''    const materializedRoot = materializePendingElement(sampled.element);\n    if (materializedRoot.element.kind !== "syntax-node") {\n      throw new Error("sampled root materialized as non-syntax node");\n    }\n    const identitySource = derivationIdentityCanonicalJson(\n      materializedRoot.canonicalSource,\n      sampled.rulePath,\n    );\n    return {\n      id: `derivation-shape:${stableRuntimeDigestCanonicalJson(identitySource)}`,\n      grammarVersion: FORMAL_GRAMMAR_VERSION,\n      root: materializedRoot.element,\n''',
"root materialization",
)

path.write_text(text)
