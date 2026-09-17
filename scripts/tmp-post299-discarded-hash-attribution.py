from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    text = text.replace(old, new, 1)

replace_once(
    'const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\n',
    '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\nconst DISCARDED_HASH_ATTRIBUTION = {\n  attempts: 0,\n  rootNullAttempts: 0,\n  postConstraintRejectedAttempts: 0,\n  acceptedAttempts: 0,\n  rootNullSlotHashes: 0,\n  rootNullSlotHashChars: 0,\n  rootNullNodeHashes: 0,\n  rootNullNodeHashChars: 0,\n  postRejectedSlotHashes: 0,\n  postRejectedSlotHashChars: 0,\n  postRejectedNodeHashes: 0,\n  postRejectedNodeHashChars: 0,\n  acceptedSlotHashes: 0,\n  acceptedSlotHashChars: 0,\n  acceptedNodeHashes: 0,\n  acceptedNodeHashChars: 0,\n  rootNullSlotCanonicalCalls: 0,\n  rootNullSlotCanonicalChars: 0,\n  rootNullNodeCanonicalCalls: 0,\n  rootNullNodeCanonicalChars: 0,\n  postRejectedSlotCanonicalCalls: 0,\n  postRejectedSlotCanonicalChars: 0,\n  postRejectedNodeCanonicalCalls: 0,\n  postRejectedNodeCanonicalChars: 0,\n  acceptedSlotCanonicalCalls: 0,\n  acceptedSlotCanonicalChars: 0,\n  acceptedNodeCanonicalCalls: 0,\n  acceptedNodeCanonicalChars: 0,\n};\n\nlet CURRENT_ATTEMPT = {\n  slotHashes: 0,\n  slotHashChars: 0,\n  nodeHashes: 0,\n  nodeHashChars: 0,\n  slotCanonicalCalls: 0,\n  slotCanonicalChars: 0,\n  nodeCanonicalCalls: 0,\n  nodeCanonicalChars: 0,\n};\n\nfunction resetCurrentAttemptAttribution(): void {\n  CURRENT_ATTEMPT = {\n    slotHashes: 0, slotHashChars: 0, nodeHashes: 0, nodeHashChars: 0,\n    slotCanonicalCalls: 0, slotCanonicalChars: 0, nodeCanonicalCalls: 0, nodeCanonicalChars: 0,\n  };\n}\n\nfunction commitCurrentAttemptAttribution(kind: "rootNull" | "postRejected" | "accepted"): void {\n  const prefix = kind;\n  const stats = DISCARDED_HASH_ATTRIBUTION as any;\n  stats[`${prefix}SlotHashes`] += CURRENT_ATTEMPT.slotHashes;\n  stats[`${prefix}SlotHashChars`] += CURRENT_ATTEMPT.slotHashChars;\n  stats[`${prefix}NodeHashes`] += CURRENT_ATTEMPT.nodeHashes;\n  stats[`${prefix}NodeHashChars`] += CURRENT_ATTEMPT.nodeHashChars;\n  stats[`${prefix}SlotCanonicalCalls`] += CURRENT_ATTEMPT.slotCanonicalCalls;\n  stats[`${prefix}SlotCanonicalChars`] += CURRENT_ATTEMPT.slotCanonicalChars;\n  stats[`${prefix}NodeCanonicalCalls`] += CURRENT_ATTEMPT.nodeCanonicalCalls;\n  stats[`${prefix}NodeCanonicalChars`] += CURRENT_ATTEMPT.nodeCanonicalChars;\n}\n\nexport function readDiscardedHashAttribution() {\n  return { ...DISCARDED_HASH_ATTRIBUTION };\n}\n\n''',
    "stats block",
)

replace_once(
    '''function lexicalSlotCanonicalJson(slot: StructuralLexicalSlot): string {\n  const fields = [\n''',
    '''function lexicalSlotCanonicalJson(slot: StructuralLexicalSlot): string {\n  const fields = [\n''',
    "slot canonical open",
)
replace_once(
    '''  ];\n  return `{${fields.join(",")}}`;\n}\n\nfunction childrenCanonicalJson''',
    '''  ];\n  const source = `{${fields.join(",")}}`;\n  CURRENT_ATTEMPT.slotCanonicalCalls += 1;\n  CURRENT_ATTEMPT.slotCanonicalChars += source.length;\n  return source;\n}\n\nfunction childrenCanonicalJson''',
    "slot canonical return",
)

replace_once(
    '''function syntaxNodeCanonicalJson(\n  node: StructuralSyntaxNode,\n  childCanonicalSources: readonly string[],\n): string {\n  return `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalJson(childCanonicalSources)},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;\n}\n''',
    '''function syntaxNodeCanonicalJson(\n  node: StructuralSyntaxNode,\n  childCanonicalSources: readonly string[],\n): string {\n  const source = `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalJson(childCanonicalSources)},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;\n  CURRENT_ATTEMPT.nodeCanonicalCalls += 1;\n  CURRENT_ATTEMPT.nodeCanonicalChars += source.length;\n  return source;\n}\n''',
    "node canonical",
)

replace_once(
    '''  const identitySource = lexicalSlotIdentityCanonicalJson(\n    constituent,\n    requirements,\n    occurrenceIndex,\n    path,\n    entryBindingId,\n  );\n  return {\n''',
    '''  const identitySource = lexicalSlotIdentityCanonicalJson(\n    constituent,\n    requirements,\n    occurrenceIndex,\n    path,\n    entryBindingId,\n  );\n  CURRENT_ATTEMPT.slotHashes += 1;\n  CURRENT_ATTEMPT.slotHashChars += identitySource.length;\n  return {\n''',
    "slot hash",
)

replace_once(
    '''    const identitySource = syntaxNodeIdentityCanonicalJson(\n      category,\n      rule.id,\n      order.id,\n      sampledChildren.childCanonicalSources,\n    );\n    const node: StructuralSyntaxNode = {\n''',
    '''    const identitySource = syntaxNodeIdentityCanonicalJson(\n      category,\n      rule.id,\n      order.id,\n      sampledChildren.childCanonicalSources,\n    );\n    CURRENT_ATTEMPT.nodeHashes += 1;\n    CURRENT_ATTEMPT.nodeHashChars += identitySource.length;\n    const node: StructuralSyntaxNode = {\n''',
    "node hash",
)

replace_once(
    '''  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {\n    const sampled = sampleCategory(\n''',
    '''  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {\n    DISCARDED_HASH_ATTRIBUTION.attempts += 1;\n    resetCurrentAttemptAttribution();\n    const sampled = sampleCategory(\n''',
    "attempt reset",
)

replace_once(
    '''    if (sampled === null || sampled.element.kind !== "syntax-node") continue;\n''',
    '''    if (sampled === null || sampled.element.kind !== "syntax-node") {\n      DISCARDED_HASH_ATTRIBUTION.rootNullAttempts += 1;\n      commitCurrentAttemptAttribution("rootNull");\n      continue;\n    }\n''',
    "root null classification",
)

replace_once(
    '''    if (requiredLexicalSlot !== undefined\n      && !sampled.slotContexts.some((context) =>\n        lexicalSlotMatchesConstraint(context, requiredLexicalSlot),\n      )) continue;\n''',
    '''    if (requiredLexicalSlot !== undefined\n      && !sampled.slotContexts.some((context) =>\n        lexicalSlotMatchesConstraint(context, requiredLexicalSlot),\n      )) {\n      DISCARDED_HASH_ATTRIBUTION.postConstraintRejectedAttempts += 1;\n      commitCurrentAttemptAttribution("postRejected");\n      continue;\n    }\n''',
    "required lexical reject",
)

replace_once(
    '''    if (requiredProductionRuleIdsAnyOf !== undefined\n      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) continue;\n''',
    '''    if (requiredProductionRuleIdsAnyOf !== undefined\n      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) {\n      DISCARDED_HASH_ATTRIBUTION.postConstraintRejectedAttempts += 1;\n      commitCurrentAttemptAttribution("postRejected");\n      continue;\n    }\n''',
    "required production reject",
)

replace_once(
    '''    const identitySource = derivationIdentityCanonicalJson(\n      sampled.canonicalSource,\n      sampled.rulePath,\n    );\n    return {\n''',
    '''    DISCARDED_HASH_ATTRIBUTION.acceptedAttempts += 1;\n    commitCurrentAttemptAttribution("accepted");\n    const identitySource = derivationIdentityCanonicalJson(\n      sampled.canonicalSource,\n      sampled.rulePath,\n    );\n    return {\n''',
    "accepted classification",
)

path.write_text(text)
