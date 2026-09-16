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

function finalizeHash32(hash: number): string {
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0).toString(16).padStart(8, "0");
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

  return [
    hash0,
    hash1,
    hash2,
    hash3,
    hash4,
    hash5,
    hash6,
    hash7,
  ].map(finalizeHash32).join("");
}

/**
 * Hash JSON that the caller has already proven is byte-for-byte equivalent to
 * JSON.stringify(canonicalValue(value)). This deliberately skips canonicalization.
 */
export function stableRuntimeDigestCanonicalJson(source: string): string {
  return hashRuntimeSource(source);
}

/**
 * Browser-safe deterministic identity digest. This is deliberately not a
 * cryptographic lineage checksum; source artifacts continue to use SHA-256.
 */
export function stableRuntimeDigest(value: unknown): string {
  const source = JSON.stringify(canonicalValue(value));
  return stableRuntimeDigestCanonicalJson(source);
}
