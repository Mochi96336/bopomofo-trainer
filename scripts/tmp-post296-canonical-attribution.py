from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

anchor = '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\n\nfunction canonicalFeatureSetJson(features: SyntaxFeatureSet): string {\n'''
insert = '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\ninterface StructuralCanonicalAttributionStats {\n  canonicalStringArrayCalls: number;\n  canonicalStringArrayIdentityHits: number;\n  canonicalStringArrayUniqueIdentities: number;\n  canonicalStringArrayItems: number;\n  canonicalFeatureSetCalls: number;\n  canonicalFeatureSetIdentityHits: number;\n  canonicalFeatureSetUniqueIdentities: number;\n  lexicalSlotIdentityCalls: number;\n  lexicalSlotIdentityConstituentHits: number;\n  lexicalSlotIdentityRequirementsHits: number;\n  lexicalSlotIdentityPathHits: number;\n  lexicalSlotCanonicalCalls: number;\n  lexicalSlotCanonicalIdentityHits: number;\n  childrenCanonicalCalls: number;\n  childrenCanonicalIdentityHits: number;\n  childrenCanonicalItems: number;\n  syntaxNodeIdentityCalls: number;\n  syntaxNodeIdentityChildrenHits: number;\n  syntaxNodeCanonicalCalls: number;\n  syntaxNodeCanonicalNodeHits: number;\n  syntaxNodeCanonicalChildrenHits: number;\n  nestedClauseKeyedCalls: number;\n  nestedClauseKeyedPriorityCalls: number;\n  nestedClauseKeyedCandidateCalls: number;\n  nestedClauseKeyedDuplicateTuples: number;\n  makeSlotCalls: number;\n  sampleRuleChildrenCalls: number;\n  sampleCategoryCalls: number;\n}\n\nconst structuralCanonicalStats: StructuralCanonicalAttributionStats = {\n  canonicalStringArrayCalls: 0,\n  canonicalStringArrayIdentityHits: 0,\n  canonicalStringArrayUniqueIdentities: 0,\n  canonicalStringArrayItems: 0,\n  canonicalFeatureSetCalls: 0,\n  canonicalFeatureSetIdentityHits: 0,\n  canonicalFeatureSetUniqueIdentities: 0,\n  lexicalSlotIdentityCalls: 0,\n  lexicalSlotIdentityConstituentHits: 0,\n  lexicalSlotIdentityRequirementsHits: 0,\n  lexicalSlotIdentityPathHits: 0,\n  lexicalSlotCanonicalCalls: 0,\n  lexicalSlotCanonicalIdentityHits: 0,\n  childrenCanonicalCalls: 0,\n  childrenCanonicalIdentityHits: 0,\n  childrenCanonicalItems: 0,\n  syntaxNodeIdentityCalls: 0,\n  syntaxNodeIdentityChildrenHits: 0,\n  syntaxNodeCanonicalCalls: 0,\n  syntaxNodeCanonicalNodeHits: 0,\n  syntaxNodeCanonicalChildrenHits: 0,\n  nestedClauseKeyedCalls: 0,\n  nestedClauseKeyedPriorityCalls: 0,\n  nestedClauseKeyedCandidateCalls: 0,\n  nestedClauseKeyedDuplicateTuples: 0,\n  makeSlotCalls: 0,\n  sampleRuleChildrenCalls: 0,\n  sampleCategoryCalls: 0,\n};\n\nconst canonicalStringArraySeen = new WeakSet<object>();\nconst canonicalFeatureSetSeen = new WeakSet<object>();\nconst lexicalSlotIdentityConstituentSeen = new WeakSet<object>();\nconst lexicalSlotIdentityRequirementsSeen = new WeakSet<object>();\nconst lexicalSlotIdentityPathSeen = new WeakSet<object>();\nconst lexicalSlotCanonicalSeen = new WeakSet<object>();\nconst childrenCanonicalSeen = new WeakSet<object>();\nconst syntaxNodeCanonicalSeen = new WeakSet<object>();\nconst nestedClauseKeyedTuples = new Set<string>();\n\nfunction recordWeakIdentity(\n  seen: WeakSet<object>,\n  value: object,\n  hitKey: keyof StructuralCanonicalAttributionStats,\n  uniqueKey?: keyof StructuralCanonicalAttributionStats,\n): void {\n  if (seen.has(value)) {\n    structuralCanonicalStats[hitKey] += 1;\n  } else {\n    seen.add(value);\n    if (uniqueKey !== undefined) structuralCanonicalStats[uniqueKey] += 1;\n  }\n}\n\nexport function structuralCanonicalAttributionStats(): Readonly<StructuralCanonicalAttributionStats> {\n  return { ...structuralCanonicalStats };\n}\n\nfunction canonicalFeatureSetJson(features: SyntaxFeatureSet): string {\n  structuralCanonicalStats.canonicalFeatureSetCalls += 1;\n  recordWeakIdentity(\n    canonicalFeatureSetSeen,\n    features as object,\n    "canonicalFeatureSetIdentityHits",\n    "canonicalFeatureSetUniqueIdentities",\n  );\n'''
if anchor not in text:
    raise SystemExit("canonical attribution insertion anchor not found")
text = text.replace(anchor, insert, 1)

old = '''function canonicalStringArrayJson(values: readonly string[]): string {\n  return JSON.stringify(values);\n}\n'''
new = '''function canonicalStringArrayJson(values: readonly string[]): string {\n  structuralCanonicalStats.canonicalStringArrayCalls += 1;\n  structuralCanonicalStats.canonicalStringArrayItems += values.length;\n  recordWeakIdentity(\n    canonicalStringArraySeen,\n    values as object,\n    "canonicalStringArrayIdentityHits",\n    "canonicalStringArrayUniqueIdentities",\n  );\n  return JSON.stringify(values);\n}\n'''
if old not in text:
    raise SystemExit("canonicalStringArrayJson anchor not found")
text = text.replace(old, new, 1)

old = '''function lexicalSlotIdentityCanonicalJson(\n  constituent: ProductionConstituent,\n  requirements: SyntaxRequirements,\n  occurrenceIndex: number,\n  path: readonly string[],\n  entryBindingId: string | undefined,\n): string {\n'''
new = old + '''  structuralCanonicalStats.lexicalSlotIdentityCalls += 1;\n  recordWeakIdentity(lexicalSlotIdentityConstituentSeen, constituent as object, "lexicalSlotIdentityConstituentHits");\n  recordWeakIdentity(lexicalSlotIdentityRequirementsSeen, requirements as object, "lexicalSlotIdentityRequirementsHits");\n  recordWeakIdentity(lexicalSlotIdentityPathSeen, path as object, "lexicalSlotIdentityPathHits");\n'''
if text.count(old) != 1:
    raise SystemExit("lexicalSlotIdentityCanonicalJson anchor not unique")
text = text.replace(old, new, 1)

old = '''function lexicalSlotCanonicalJson(slot: StructuralLexicalSlot): string {\n'''
new = old + '''  structuralCanonicalStats.lexicalSlotCanonicalCalls += 1;\n  recordWeakIdentity(lexicalSlotCanonicalSeen, slot as object, "lexicalSlotCanonicalIdentityHits");\n'''
if text.count(old) != 1:
    raise SystemExit("lexicalSlotCanonicalJson anchor not unique")
text = text.replace(old, new, 1)

old = '''function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {\n  return `[${childCanonicalSources.join(",")}]`;\n}\n'''
new = '''function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {\n  structuralCanonicalStats.childrenCanonicalCalls += 1;\n  structuralCanonicalStats.childrenCanonicalItems += childCanonicalSources.length;\n  recordWeakIdentity(childrenCanonicalSeen, childCanonicalSources as object, "childrenCanonicalIdentityHits");\n  return `[${childCanonicalSources.join(",")}]`;\n}\n'''
if old not in text:
    raise SystemExit("childrenCanonicalJson anchor not found")
text = text.replace(old, new, 1)

old = '''function syntaxNodeIdentityCanonicalJson(\n  category: SyntaxCategory,\n  productionRuleId: string,\n  surfaceOrderId: string,\n  childCanonicalSources: readonly string[],\n): string {\n'''
new = old + '''  structuralCanonicalStats.syntaxNodeIdentityCalls += 1;\n  if (childrenCanonicalSeen.has(childCanonicalSources as object)) {\n    structuralCanonicalStats.syntaxNodeIdentityChildrenHits += 1;\n  }\n'''
if text.count(old) != 1:
    raise SystemExit("syntaxNodeIdentityCanonicalJson anchor not unique")
text = text.replace(old, new, 1)

old = '''function syntaxNodeCanonicalJson(\n  node: StructuralSyntaxNode,\n  childCanonicalSources: readonly string[],\n): string {\n'''
new = old + '''  structuralCanonicalStats.syntaxNodeCanonicalCalls += 1;\n  recordWeakIdentity(syntaxNodeCanonicalSeen, node as object, "syntaxNodeCanonicalNodeHits");\n  if (childrenCanonicalSeen.has(childCanonicalSources as object)) {\n    structuralCanonicalStats.syntaxNodeCanonicalChildrenHits += 1;\n  }\n'''
if text.count(old) != 1:
    raise SystemExit("syntaxNodeCanonicalJson anchor not unique")
text = text.replace(old, new, 1)

old = '''function nestedClauseKeyedCanonicalJson(\n  purpose: "candidate-substream" | "priority",\n  ticket: number,\n  ruleId: string,\n): string {\n'''
new = old + '''  structuralCanonicalStats.nestedClauseKeyedCalls += 1;\n  if (purpose === "priority") structuralCanonicalStats.nestedClauseKeyedPriorityCalls += 1;\n  else structuralCanonicalStats.nestedClauseKeyedCandidateCalls += 1;\n  const attributionTuple = `${purpose}\\u0000${ticket}\\u0000${ruleId}`;\n  if (nestedClauseKeyedTuples.has(attributionTuple)) structuralCanonicalStats.nestedClauseKeyedDuplicateTuples += 1;\n  else nestedClauseKeyedTuples.add(attributionTuple);\n'''
if text.count(old) != 1:
    raise SystemExit("nestedClauseKeyedCanonicalJson anchor not unique")
text = text.replace(old, new, 1)

old = '''function makeSlot(\n  constituent: ProductionConstituent,\n  requirements: SyntaxRequirements,\n  occurrenceIndex: number,\n  path: readonly string[],\n): StructuralLexicalSlot {\n'''
new = old + '''  structuralCanonicalStats.makeSlotCalls += 1;\n'''
if text.count(old) != 1:
    raise SystemExit("makeSlot anchor not unique")
text = text.replace(old, new, 1)

old = '''): SampledRuleChildren | null {\n  let workingState = inputState;\n'''
new = '''): SampledRuleChildren | null {\n  structuralCanonicalStats.sampleRuleChildrenCalls += 1;\n  let workingState = inputState;\n'''
if text.count(old) != 1:
    raise SystemExit("sampleRuleChildren body anchor not unique")
text = text.replace(old, new, 1)

old = '''): Sampled | null {\n  let state = inputState;\n'''
new = '''): Sampled | null {\n  structuralCanonicalStats.sampleCategoryCalls += 1;\n  let state = inputState;\n'''
if text.count(old) != 1:
    raise SystemExit("sampleCategory body anchor not unique")
text = text.replace(old, new, 1)

path.write_text(text)
