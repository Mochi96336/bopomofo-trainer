function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) result[key] = canonicalValue(item);
    }
    return result;
  }
  return value;
}

const RUNTIME_DIGEST_SEEDS = [
  0x243f6a88,
  0x85a308d3,
  0x13198a2e,
  0x03707344,
  0xa4093822,
  0x299f31d0,
  0x082efa98,
  0xec4e6c89,
] as const;

const HEX_BYTE = Array.from(
  { length: 256 },
  (_, value) => value.toString(16).padStart(2, "0"),
);

function finalizeHash32Value(hash: number): number {
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function uint32Hex(value: number): string {
  return HEX_BYTE[(value >>> 24) & 0xff]!
    + HEX_BYTE[(value >>> 16) & 0xff]!
    + HEX_BYTE[(value >>> 8) & 0xff]!
    + HEX_BYTE[value & 0xff]!;
}

function finalizeHash32(hash: number): string {
  return uint32Hex(finalizeHash32Value(hash));
}

const RUNTIME_DIGEST_FIRST32_OFFSET = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[0]) >>> 0;

function updateRuntimeDigestFirst32(hash: number, source: string): number {
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Pre-hash a stable source prefix for callers that repeatedly vary only a later
 * fragment. The returned state is intentionally unfinished: callers must pass it
 * through stableRuntimeDigestSourceFirstUint32FromPrefixState before comparing
 * it with a normal runtime-digest lane.
 */
export function stableRuntimeDigestSourceFirstUint32PrefixState(prefix: string): number {
  return updateRuntimeDigestFirst32(RUNTIME_DIGEST_FIRST32_OFFSET, prefix);
}

/**
 * Finish the first 32-bit runtime-digest lane from a previously hashed prefix,
 * one dynamic fragment, and one suffix. This is byte-for-byte equivalent to
 * stableRuntimeDigestCanonicalJsonFirstUint32(prefix + dynamicSource + suffix)
 * when that concatenation is proven canonical by the caller.
 */
export function stableRuntimeDigestSourceFirstUint32FromPrefixState(
  prefixState: number,
  dynamicSource: string,
  suffix: string,
): number {
  let hash = updateRuntimeDigestFirst32(prefixState, dynamicSource);
  hash = updateRuntimeDigestFirst32(hash, suffix);
  return finalizeHash32Value(hash);
}

function hashRuntimeSourceFirst32(source: string): number {
  return finalizeHash32Value(
    stableRuntimeDigestSourceFirstUint32PrefixState(source),
  );
}

function hashRuntimeSource(source: string): string {
  let hash0 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[0]) >>> 0;
  let hash1 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[1]) >>> 0;
  let hash2 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[2]) >>> 0;
  let hash3 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[3]) >>> 0;
  let hash4 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[4]) >>> 0;
  let hash5 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[5]) >>> 0;
  let hash6 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[6]) >>> 0;
  let hash7 = (0x811c9dc5 ^ RUNTIME_DIGEST_SEEDS[7]) >>> 0;

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    hash0 = Math.imul(hash0 ^ code, 0x01000193) >>> 0;
    hash1 = Math.imul(hash1 ^ code, 0x01000193) >>> 0;
    hash2 = Math.imul(hash2 ^ code, 0x01000193) >>> 0;
    hash3 = Math.imul(hash3 ^ code, 0x01000193) >>> 0;
    hash4 = Math.imul(hash4 ^ code, 0x01000193) >>> 0;
    hash5 = Math.imul(hash5 ^ code, 0x01000193) >>> 0;
    hash6 = Math.imul(hash6 ^ code, 0x01000193) >>> 0;
    hash7 = Math.imul(hash7 ^ code, 0x01000193) >>> 0;
  }

  return finalizeHash32(hash0)
    + finalizeHash32(hash1)
    + finalizeHash32(hash2)
    + finalizeHash32(hash3)
    + finalizeHash32(hash4)
    + finalizeHash32(hash5)
    + finalizeHash32(hash6)
    + finalizeHash32(hash7);
}

/**
 * Hash JSON that the caller has already proven is byte-for-byte equivalent to
 * JSON.stringify(canonicalValue(value)). This deliberately skips canonicalization.
 */
export function stableRuntimeDigestCanonicalJson(source: string): string {
  return hashRuntimeSource(source);
}

/**
 * Return the first 32-bit lane of the stable runtime digest for JSON that
 * the caller has already proven canonical. This is byte-for-byte equal to
 * parsing the first eight hex digits of stableRuntimeDigestCanonicalJson().
 */
export function stableRuntimeDigestCanonicalJsonFirstUint32(source: string): number {
  return hashRuntimeSourceFirst32(source);
}

/**
 * Browser-safe deterministic identity digest. This is deliberately not a
 * cryptographic lineage checksum; source artifacts continue to use SHA-256.
 */
export function stableRuntimeDigest(value: unknown): string {
  const source = JSON.stringify(canonicalValue(value));
  return stableRuntimeDigestCanonicalJson(source);
}
