from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old_function = '''function nestedClausePriorityFirstHex(canonicalJson: string): string {
  return stableRuntimeDigestCanonicalJsonFirstUint32(canonicalJson)
    .toString(16)
    .padStart(8, "0");
}'''
new_function = '''function nestedClausePriorityFirstUint32(canonicalJson: string): number {
  return stableRuntimeDigestCanonicalJsonFirstUint32(canonicalJson);
}'''

old_property = '''        priorityFirstHex: nestedClausePriorityFirstHex(priorityCanonicalJson),'''
new_property = '''        priorityFirstUint32: nestedClausePriorityFirstUint32(priorityCanonicalJson),'''

old_compare = '''      const firstLaneOrder = left.priorityFirstHex.localeCompare(right.priorityFirstHex);
      if (firstLaneOrder !== 0) return firstLaneOrder;'''
new_compare = '''      if (left.priorityFirstUint32 !== right.priorityFirstUint32) {
        return left.priorityFirstUint32 < right.priorityFirstUint32 ? -1 : 1;
      }'''

for label, old in [
    ("priority helper", old_function),
    ("priority property", old_property),
    ("priority comparator", old_compare),
]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label} snippet, found {count}")

text = text.replace(old_function, new_function)
text = text.replace(old_property, new_property)
text = text.replace(old_compare, new_compare)
path.write_text(text)
