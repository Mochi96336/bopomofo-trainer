from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

replacements = [
    (
'''  const children: PendingStructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
  const rulePath: string[] = [];
''',
'''  let children: PendingStructuralElement[] | undefined;
  let slots: StructuralLexicalSlot[] | undefined;
  let slotContexts: SampledLexicalSlotContext[] | undefined;
  let rulePath: string[] | undefined;
''',
"accumulator declarations",
    ),
    (
'''        children.push(slot);
        slots.push(slot);
        slotContexts.push({
''',
'''        (children ??= []).push(slot);
        (slots ??= []).push(slot);
        (slotContexts ??= []).push({
''',
"lexical pushes",
    ),
    (
'''      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      rulePath.push(...child.rulePath);
''',
'''      (children ??= []).push(child.element);
      if (child.slots.length > 0) (slots ??= []).push(...child.slots);
      if (child.slotContexts.length > 0) (slotContexts ??= []).push(...child.slotContexts);
      if (child.rulePath.length > 0) (rulePath ??= []).push(...child.rulePath);
''',
"recursive pushes",
    ),
    (
'''    children,
    rulePath,
    slots,
    slotContexts,
''',
'''    children: children ?? [],
    rulePath: rulePath ?? [],
    slots: slots ?? [],
    slotContexts: slotContexts ?? [],
''',
"return arrays",
    ),
]

for old, new, label in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} snippet, found {count}")
    text = text.replace(old, new, 1)

path.write_text(text)
