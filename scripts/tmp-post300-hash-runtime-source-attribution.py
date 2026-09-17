from pathlib import Path

p = Path("src/core/stable-id.ts")
s = p.read_text()

anchor = '''function finalizeHash32Value(hash: number): number {\n'''
instrumentation = r'''interface RuntimeHashAttributionBucketState {
  calls: number;
  sourceChars: number;
  laneCharWork: number;
  minChars: number;
  maxChars: number;
  readonly uniqueSources: Set<string>;
}

export interface RuntimeHashAttributionBucket {
  readonly kind: string;
  readonly calls: number;
  readonly sourceChars: number;
  readonly laneCharWork: number;
  readonly averageChars: number;
  readonly minChars: number;
  readonly maxChars: number;
  readonly uniqueSources: number;
  readonly repeatedCalls: number;
}

let runtimeHashAttributionEnabled = false;
const runtimeHashAttribution = new Map<string, RuntimeHashAttributionBucketState>();

function runtimeHashSourceKind(source: string): string {
  if (source.startsWith('{"seed":') && source.includes('"slotId":')) return "seeded-offset";
  if (source.startsWith('{"derivationId":') && source.includes('"entryIds":') && source.includes('"tokens":')) return "surface-realization-identity";
  if (source.startsWith('{"grammarVersion":') && source.includes('"productionRulePath":') && source.includes('"root":')) return "derivation-identity";
  if (source.startsWith('{"allowedUpos":')) {
    return source.includes('"kind":"lexical-slot"') ? "lexical-slot-canonical" : "lexical-slot-identity";
  }
  if (source.startsWith('{"category":')) {
    return source.includes('"kind":"syntax-node"') ? "syntax-node-canonical" : "syntax-node-identity";
  }
  if (source.startsWith('{"purpose":')) {
    if (source.includes('"purpose":"candidate-substream"')) return "nested-candidate-substream";
    if (source.includes('"purpose":"priority"')) return "nested-priority";
    return "nested-keyed";
  }
  if (source.startsWith('{"ticketUnit":') && source.includes('"version":')) return "argument-realization-ticket";
  if (source.startsWith("[")) return "generic-array";
  if (source.startsWith("{")) return "generic-object";
  if (source.startsWith('"')) return "generic-string";
  return "generic-primitive";
}

function recordRuntimeHashAttribution(source: string, laneCount: 1 | 8): void {
  if (!runtimeHashAttributionEnabled) return;
  const kind = `${laneCount === 8 ? "full8" : "first1"}:${runtimeHashSourceKind(source)}`;
  let bucket = runtimeHashAttribution.get(kind);
  if (bucket === undefined) {
    bucket = { calls: 0, sourceChars: 0, laneCharWork: 0, minChars: Number.POSITIVE_INFINITY, maxChars: 0, uniqueSources: new Set<string>() };
    runtimeHashAttribution.set(kind, bucket);
  }
  bucket.calls += 1;
  bucket.sourceChars += source.length;
  bucket.laneCharWork += source.length * laneCount;
  bucket.minChars = Math.min(bucket.minChars, source.length);
  bucket.maxChars = Math.max(bucket.maxChars, source.length);
  bucket.uniqueSources.add(source);
}

export function resetRuntimeHashAttribution(): void { runtimeHashAttribution.clear(); }
export function setRuntimeHashAttributionEnabled(enabled: boolean): void { runtimeHashAttributionEnabled = enabled; }
export function readRuntimeHashAttribution(): readonly RuntimeHashAttributionBucket[] {
  return [...runtimeHashAttribution.entries()]
    .map(([kind, bucket]) => ({
      kind,
      calls: bucket.calls,
      sourceChars: bucket.sourceChars,
      laneCharWork: bucket.laneCharWork,
      averageChars: bucket.calls === 0 ? 0 : bucket.sourceChars / bucket.calls,
      minChars: bucket.minChars === Number.POSITIVE_INFINITY ? 0 : bucket.minChars,
      maxChars: bucket.maxChars,
      uniqueSources: bucket.uniqueSources.size,
      repeatedCalls: bucket.calls - bucket.uniqueSources.size,
    }))
    .sort((left, right) => right.laneCharWork - left.laneCharWork || right.calls - left.calls);
}

function finalizeHash32Value(hash: number): number {
'''
if anchor not in s:
    raise SystemExit("finalizeHash32Value anchor missing")
s = s.replace(anchor, instrumentation, 1)

old_first = '''  return finalizeHash32Value(hash);\n}\n\nfunction hashRuntimeSource(source: string): string {\n'''
new_first = '''  const result = finalizeHash32Value(hash);\n  recordRuntimeHashAttribution(source, 1);\n  return result;\n}\n\nfunction hashRuntimeSource(source: string): string {\n'''
if old_first not in s:
    raise SystemExit("first32 return anchor missing")
s = s.replace(old_first, new_first, 1)

old_full = '''  return finalizeHash32(hash0)\n    + finalizeHash32(hash1)\n    + finalizeHash32(hash2)\n    + finalizeHash32(hash3)\n    + finalizeHash32(hash4)\n    + finalizeHash32(hash5)\n    + finalizeHash32(hash6)\n    + finalizeHash32(hash7);\n}\n'''
new_full = '''  const digest = finalizeHash32(hash0)\n    + finalizeHash32(hash1)\n    + finalizeHash32(hash2)\n    + finalizeHash32(hash3)\n    + finalizeHash32(hash4)\n    + finalizeHash32(hash5)\n    + finalizeHash32(hash6)\n    + finalizeHash32(hash7);\n  recordRuntimeHashAttribution(source, 8);\n  return digest;\n}\n'''
if old_full not in s:
    raise SystemExit("full hash return anchor missing")
s = s.replace(old_full, new_full, 1)

p.write_text(s)
