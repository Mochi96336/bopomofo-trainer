from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

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
  let cachedId: string | undefined;
  return {
    kind: "lexical-slot",
    get id() {
      cachedId ??= `syntax-slot:${stableRuntimeDigestCanonicalJson(lexicalSlotIdentityCanonicalJson(
        constituent,
        requirements,
        occurrenceIndex,
        path,
        entryBindingId,
      ))}`;
      return cachedId;
    },
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
}'''

new = '''function makeSlot(
  constituent: ProductionConstituent,
  requirements: SyntaxRequirements,
  occurrenceIndex: number,
  path: readonly string[],
): StructuralLexicalSlot {
  type MutableLexicalSlot = {
    -readonly [Key in keyof StructuralLexicalSlot]: StructuralLexicalSlot[Key];
  };
  const entryBindingId = bindingId(constituent, path);
  let cachedId: string | undefined;
  const slot = {
    kind: "lexical-slot",
    get id() {
      cachedId ??= `syntax-slot:${stableRuntimeDigestCanonicalJson(lexicalSlotIdentityCanonicalJson(
        constituent,
        requirements,
        occurrenceIndex,
        path,
        entryBindingId,
      ))}`;
      return cachedId;
    },
    constituentKey: constituent.key,
    occurrenceIndex,
    allowedUpos: constituent.allowedUpos,
    requiredFunctions: requirements.requiredFunctions,
    requiredValencyFrames: requirements.requiredValencyFrames,
  } as MutableLexicalSlot;
  if (requirements.requiredOccurrenceCapabilities.length !== 0) {
    slot.requiredOccurrenceCapabilities = requirements.requiredOccurrenceCapabilities;
  }
  slot.requiredFeatures = requirements.requiredFeatures;
  if (entryBindingId !== undefined) slot.entryBindingId = entryBindingId;
  if (constituent.formalLiteral !== undefined) slot.formalLiteral = constituent.formalLiteral;
  return slot;
}'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one makeSlot body, found {count}")
path.write_text(text.replace(old, new))
