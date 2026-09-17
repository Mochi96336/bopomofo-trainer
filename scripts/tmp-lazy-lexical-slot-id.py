from pathlib import Path

p = Path("src/syntax/sample.ts")
s = p.read_text()
old = '''  const occurrenceRequirement = requirements.requiredOccurrenceCapabilities.length === 0
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
'''
new = '''  const occurrenceRequirement = requirements.requiredOccurrenceCapabilities.length === 0
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
'''
if old not in s:
    raise SystemExit("makeSlot identity anchor missing")
s = s.replace(old, new, 1)
p.write_text(s)
