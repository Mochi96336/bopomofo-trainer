from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old = '''interface SampledLexicalSlotContext {
  readonly slot: StructuralLexicalSlot;
  readonly enclosingRequiredFunctions: readonly SyntacticFunction[];
}

interface Sampled {
'''
new = '''interface SampledLexicalSlotContext {
  readonly slot: StructuralLexicalSlot;
  readonly enclosingRequiredFunctions: readonly SyntacticFunction[];
}

interface MadeSlot {
  readonly slot: StructuralLexicalSlot;
  readonly canonicalSource: string;
}

interface Sampled {
'''
if old not in text:
    raise SystemExit("slot context block not found")
text = text.replace(old, new, 1)

start = text.index("function lexicalSlotIdentityCanonicalJson(")
end = text.index("function childrenCanonicalJson(", start)
text = text[:start] + text[end:]

old = '''function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
): StructuralLexicalSlot {
  const entryBindingId = bindingId(constituent, path);
  const occurrenceRequirement = requirements.requiredOccurrenceCapabilities.length === 0
    ? {}
    : { requiredOccurrenceCapabilities: requirements.requiredOccurrenceCapabilities };
  const identitySource = lexicalSlotIdentityCanonicalJson(
    constituent,
    requirements,
    occurrenceIndex,
    path,
    entryBindingId,
  );
  return {
    kind: "lexical-slot",
    id: `syntax-slot:${stableRuntimeDigestCanonicalJson(identitySource)}`,
    constituentKey: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
    ...occurrenceRequirement,
    requiredFeatures: requirements.requiredFeatures,
    ...(entryBindingId === undefined ? {} : { entryBindingId }),
    ...(constituent.formalLiteral === undefined ? {} : { formalLiteral: constituent.formalLiteral }),
  };
}
'''
new = '''function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
): MadeSlot {
  const entryBindingId = bindingId(constituent, path);
  const occurrenceCapabilities = requirements.requiredOccurrenceCapabilities;
  const occurrenceRequirement = occurrenceCapabilities.length === 0
    ? {}
    : { requiredOccurrenceCapabilities: occurrenceCapabilities };
  const allowedUposCanonical = canonicalStringArrayJson(constituent.allowedUpos);
  const requiredFeaturesCanonical = canonicalFeatureSetJson(requirements.requiredFeatures);
  const requiredFunctionsCanonical = canonicalStringArrayJson(requirements.requiredFunctions);
  const requiredOccurrenceCapabilitiesCanonical = occurrenceCapabilities.length === 0
    ? undefined
    : canonicalStringArrayJson(occurrenceCapabilities);
  const requiredValencyFramesCanonical = canonicalStringArrayJson(requirements.requiredValencyFrames);
  const identityFields = [
    `"allowedUpos":${allowedUposCanonical}`,
    ...(entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(entryBindingId)}`]),
    ...(constituent.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(constituent.formalLiteral)}`]),
    `"key":${JSON.stringify(constituent.key)}`,
    `"occurrenceIndex":${occurrenceIndex}`,
    `"path":${canonicalStringArrayJson(path)}`,
    `"requiredFeatures":${requiredFeaturesCanonical}`,
    `"requiredFunctions":${requiredFunctionsCanonical}`,
    ...(requiredOccurrenceCapabilitiesCanonical === undefined
      ? []
      : [`"requiredOccurrenceCapabilities":${requiredOccurrenceCapabilitiesCanonical}`]),
    `"requiredValencyFrames":${requiredValencyFramesCanonical}`,
  ];
  const id = `syntax-slot:${stableRuntimeDigestCanonicalJson(`{${identityFields.join(",")}}`)}`;
  const slot: StructuralLexicalSlot = {
    kind: "lexical-slot",
    id,
    constituentKey: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
    ...occurrenceRequirement,
    requiredFeatures: requirements.requiredFeatures,
    ...(entryBindingId === undefined ? {} : { entryBindingId }),
    ...(constituent.formalLiteral === undefined ? {} : { formalLiteral: constituent.formalLiteral }),
  };
  const canonicalFields = [
    `"allowedUpos":${allowedUposCanonical}`,
    `"constituentKey":${JSON.stringify(slot.constituentKey)}`,
    ...(entryBindingId === undefined ? [] : [`"entryBindingId":${JSON.stringify(entryBindingId)}`]),
    ...(constituent.formalLiteral === undefined ? [] : [`"formalLiteral":${JSON.stringify(constituent.formalLiteral)}`]),
    `"id":${JSON.stringify(id)}`,
    `"kind":"lexical-slot"`,
    `"occurrenceIndex":${occurrenceIndex}`,
    `"requiredFeatures":${requiredFeaturesCanonical}`,
    `"requiredFunctions":${requiredFunctionsCanonical}`,
    ...(requiredOccurrenceCapabilitiesCanonical === undefined
      ? []
      : [`"requiredOccurrenceCapabilities":${requiredOccurrenceCapabilitiesCanonical}`]),
    `"requiredValencyFrames":${requiredValencyFramesCanonical}`,
  ];
  return { slot, canonicalSource: `{${canonicalFields.join(",")}}` };
}
'''
if old not in text:
    raise SystemExit("makeSlot block not found")
text = text.replace(old, new, 1)

old = '''        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          [...path, constituent.key],
        );
        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        childCanonicalSources.push(lexicalSlotCanonicalJson(slot));
'''
new = '''        const { slot, canonicalSource } = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          [...path, constituent.key],
        );
        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;
        children.push(slot);
        childCanonicalSources.push(canonicalSource);
'''
if old not in text:
    raise SystemExit("makeSlot call site not found")
text = text.replace(old, new, 1)

path.write_text(text)
