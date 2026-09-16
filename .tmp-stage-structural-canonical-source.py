from pathlib import Path

p = Path("src/syntax/sample.ts")
s = p.read_text()

old = """interface Sampled {
  readonly element: StructuralElement;
  readonly state: State;
"""
new = """interface Sampled {
  readonly element: StructuralElement;
  readonly canonicalSource: string;
  readonly state: State;
"""
if old not in s:
    raise SystemExit("Sampled interface anchor missing")
s = s.replace(old, new, 1)

old = """interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly StructuralElement[];
  readonly rulePath: readonly string[];
"""
new = """interface SampledRuleChildren {
  readonly state: State;
  readonly children: readonly StructuralElement[];
  readonly childCanonicalSources: readonly string[];
  readonly rulePath: readonly string[];
"""
if old not in s:
    raise SystemExit("SampledRuleChildren interface anchor missing")
s = s.replace(old, new, 1)

marker = "const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n"
helpers = marker + r'''

function canonicalFeatureSetJson(features: SyntaxFeatureSet): string {
  const fields = Object.keys(features)
    .filter((key) => features[key as SyntaxFeatureName] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(features[key as SyntaxFeatureName])}`);
  return `{${fields.join(",")}}`;
}

function canonicalStringArrayJson(values: readonly string[]): string {
  return JSON.stringify(values);
}

function lexicalSlotIdentityCanonicalJson(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
  entryBindingId: string | undefined,
): string {
  const fields = [
    `"allowedUpos":${canonicalStringArrayJson(constituent.allowedUpos)}`,
    ...(entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(entryBindingId)}`]),
    ...(constituent.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(constituent.formalLiteral)}`]),
    `"key":${JSON.stringify(constituent.key)}`,
    `"occurrenceIndex":${occurrenceIndex}`,
    `"path":${canonicalStringArrayJson(path)}`,
    `"requiredFeatures":${canonicalFeatureSetJson(requirements.requiredFeatures)}`,
    `"requiredFunctions":${canonicalStringArrayJson(requirements.requiredFunctions)}`,
    ...(requirements.requiredOccurrenceCapabilities.length === 0
      ? []
      : [`"requiredOccurrenceCapabilities":${canonicalStringArrayJson(requirements.requiredOccurrenceCapabilities)}`]),
    `"requiredValencyFrames":${canonicalStringArrayJson(requirements.requiredValencyFrames)}`,
  ];
  return `{${fields.join(",")}}`;
}

function lexicalSlotCanonicalJson(slot: StructuralLexicalSlot): string {
  const fields = [
    `"allowedUpos":${canonicalStringArrayJson(slot.allowedUpos)}`,
    `"constituentKey":${JSON.stringify(slot.constituentKey)}`,
    ...(slot.entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(slot.entryBindingId)}`]),
    ...(slot.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(slot.formalLiteral)}`]),
    `"id":${JSON.stringify(slot.id)}`,
    `"kind":"lexical-slot"`,
    `"occurrenceIndex":${slot.occurrenceIndex}`,
    `"requiredFeatures":${canonicalFeatureSetJson(slot.requiredFeatures)}`,
    `"requiredFunctions":${canonicalStringArrayJson(slot.requiredFunctions)}`,
    ...(slot.requiredOccurrenceCapabilities === undefined
      ? []
      : [`"requiredOccurrenceCapabilities":${canonicalStringArrayJson(slot.requiredOccurrenceCapabilities)}`]),
    `"requiredValencyFrames":${canonicalStringArrayJson(slot.requiredValencyFrames)}`,
  ];
  return `{${fields.join(",")}}`;
}

function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {
  return `[${childCanonicalSources.join(",")}]`;
}

function syntaxNodeIdentityCanonicalJson(
  category: SyntaxCategory,
  productionRuleId: string,
  surfaceOrderId: string,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(category)},"children":${childrenCanonicalJson(childCanonicalSources)},"productionRuleId":${JSON.stringify(productionRuleId)},"surfaceOrderId":${JSON.stringify(surfaceOrderId)}}`;
}

function syntaxNodeCanonicalJson(
  node: StructuralSyntaxNode,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalJson(childCanonicalSources)},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;
}

function derivationIdentityCanonicalJson(
  rootCanonicalSource: string,
  productionRulePath: readonly string[],
): string {
  return `{"grammarVersion":${JSON.stringify(FORMAL_GRAMMAR_VERSION)},"productionRulePath":${canonicalStringArrayJson(productionRulePath)},"root":${rootCanonicalSource}}`;
}
'''
if marker not in s:
    raise SystemExit("helper marker missing")
s = s.replace(marker, helpers, 1)

old = """  const identity = {
    path,
    key: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
    ...occurrenceRequirement,
    requiredFeatures: requirements.requiredFeatures,
    entryBindingId,
    formalLiteral: constituent.formalLiteral,
  };
  return {
    kind: \"lexical-slot\",
    id: `syntax-slot:${stableRuntimeDigest(identity)}`,
"""
new = """  const identitySource = lexicalSlotIdentityCanonicalJson(
    constituent,
    requirements,
    occurrenceIndex,
    path,
    entryBindingId,
  );
  return {
    kind: \"lexical-slot\",
    id: `syntax-slot:${stableRuntimeDigestCanonicalJson(identitySource)}`,
"""
if old not in s:
    raise SystemExit("makeSlot identity anchor missing")
s = s.replace(old, new, 1)

old = """  const children: StructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
"""
new = """  const children: StructuralElement[] = [];
  const childCanonicalSources: string[] = [];
  const slots: StructuralLexicalSlot[] = [];
"""
if old not in s:
    raise SystemExit("children declaration anchor missing")
s = s.replace(old, new, 1)

old = """        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        slots.push(slot);
"""
new = """        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        childCanonicalSources.push(lexicalSlotCanonicalJson(slot));
        slots.push(slot);
"""
if old not in s:
    raise SystemExit("lexical child anchor missing")
s = s.replace(old, new, 1)

old = """      if (child === null) return null;
      children.push(child.element);
      slots.push(...child.slots);
"""
new = """      if (child === null) return null;
      children.push(child.element);
      childCanonicalSources.push(child.canonicalSource);
      slots.push(...child.slots);
"""
if old not in s:
    raise SystemExit("nonlexical child anchor missing")
s = s.replace(old, new, 1)

old = """  return { state: workingState, children, rulePath, slots, slotContexts };
}
"""
new = """  return {
    state: workingState,
    children,
    childCanonicalSources,
    rulePath,
    slots,
    slotContexts,
  };
}
"""
if old not in s:
    raise SystemExit("sampleRuleChildren return anchor missing")
s = s.replace(old, new, 1)

old = """    const identity = {
      category,
      productionRuleId: rule.id,
      surfaceOrderId: order.id,
      children: sampledChildren.children,
    };
    const node: StructuralSyntaxNode = {
      kind: \"syntax-node\",
      id: `syntax-node:${stableRuntimeDigest(identity)}`,
      category,
      productionRuleId: rule.id,
      surfaceOrderId: order.id,
      children: sampledChildren.children,
    };
    return {
      element: node,
      state: sampledChildren.state,
"""
new = """    const identitySource = syntaxNodeIdentityCanonicalJson(
      category,
      rule.id,
      order.id,
      sampledChildren.childCanonicalSources,
    );
    const node: StructuralSyntaxNode = {
      kind: \"syntax-node\",
      id: `syntax-node:${stableRuntimeDigestCanonicalJson(identitySource)}`,
      category,
      productionRuleId: rule.id,
      surfaceOrderId: order.id,
      children: sampledChildren.children,
    };
    return {
      element: node,
      canonicalSource: syntaxNodeCanonicalJson(node, sampledChildren.childCanonicalSources),
      state: sampledChildren.state,
"""
if old not in s:
    raise SystemExit("sampleCategory node anchor missing")
s = s.replace(old, new, 1)

old = """    const identity = {
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      root: sampled.element,
      productionRulePath: sampled.rulePath,
    };
    return {
      id: `derivation-shape:${stableRuntimeDigest(identity)}`,
"""
new = """    const identitySource = derivationIdentityCanonicalJson(
      sampled.canonicalSource,
      sampled.rulePath,
    );
    return {
      id: `derivation-shape:${stableRuntimeDigestCanonicalJson(identitySource)}`,
"""
if old not in s:
    raise SystemExit("derivation identity anchor missing")
s = s.replace(old, new, 1)

p.write_text(s)
