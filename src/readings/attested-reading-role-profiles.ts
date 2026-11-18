import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { StructuralLexicalSlot } from "../syntax/derive.js";
import { sha256Canonical } from "../reference/importers/canonical-json.js";
import type { RuntimeSyntaxProfile, SyntacticFunction, Upos } from "../syntax/types.js";

/**
 * Research-only input to a versioned, reading-specific role overlay.
 * This is deliberately NOT a G2P predictor and it never manufactures
 * a pronunciation for an unlabelled UD token. Existing UD profiles remain
 * unchanged; dictionary role evidence has separate provenance and zero UD counts.
 *
 * Future contexts need their own independently reviewed predicate in
 * contextGateAllows(). Unknown gates are rejected, never approximated.
 */
export interface ReviewedReadingRoleRow {
  readonly word: string;
  readonly reading: string;
  readonly entryId: string;
  readonly upos: Upos;
  readonly role: SyntacticFunction;
  readonly contextGate: "numeric-classifier-v1";
  readonly evidence: {
    readonly authority: "moe-revised-2021";
    readonly sourceUrl: string;
    readonly kind: "dictionary-lexical-role-only";
    readonly reviewStatus: "role-reading-reviewed";
  };
}

export interface ReviewedReadingRoleManifest {
  readonly schemaVersion: "reviewed-reading-role-evidence-v1";
  readonly purpose: string;
  readonly rows: readonly ReviewedReadingRoleRow[];
}

export interface ReadingRoleProjectionRow {
  readonly entryId: string;
  readonly word: string;
  readonly upos: Upos;
  readonly role: SyntacticFunction;
  readonly status: "existing-runtime-role" | "new-source-role-profile";
  readonly profileId: string;
  readonly sourceUrl: string;
}

export interface ReviewedReadingRoleProjection {
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly report: {
    readonly manifestRows: number;
    readonly existingRuntimeRoleRows: number;
    readonly addedSourceRoleProfiles: number;
    readonly rows: readonly ReadingRoleProjectionRow[];
    readonly determinismDigest: string;
  };
  readonly readingEligible: (
    entry: CatalogEntry, profile: RuntimeSyntaxProfile,
    slot: StructuralLexicalSlot, previousEntry: CatalogEntry | null,
  ) => boolean;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(label + " must be an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(label + " has missing or unexpected fields");
  }
}

const SOURCE_URL = /^https:\/\/dict\.revised\.moe\.edu\.tw\/dictView\.jsp\?ID=[0-9]+$/u;
const READING = /^[\u3105-\u3129]+[1-5](?:-[\u3105-\u3129]+[1-5])*$/u;
const NUMERAL = /^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u;
const SOURCE_PROFILE_PREFIX = "attested-reading-role:";

/** Fail-closed loader: type assertions alone are NOT evidence validation. */
export function parseReviewedReadingRoleManifest(value: unknown): ReviewedReadingRoleManifest {
  const input = record(value, "reading-role manifest");
  exactKeys(input, ["schemaVersion", "purpose", "rows"], "reading-role manifest");
  if (input.schemaVersion !== "reviewed-reading-role-evidence-v1"
    || typeof input.purpose !== "string"
    || input.purpose.length === 0
    || !Array.isArray(input.rows)) {
    throw new Error("unsupported or malformed reading-role manifest");
  }
  const rows: ReviewedReadingRoleRow[] = [];
  const seenIdentities = new Set<string>();
  const seenRoleKeys = new Set<string>();
  for (const raw of input.rows) {
    const row = record(raw, "reading-role row");
    exactKeys(row, ["word", "reading", "entryId", "upos", "role", "contextGate", "evidence"],
      "reading-role row");
    const evidence = record(row.evidence, "reading-role evidence");
    exactKeys(evidence, ["authority", "sourceUrl", "kind", "reviewStatus"],
      "reading-role evidence");
    // Only this construction has independently source-checked reading-specific
    // evidence. Adding a second constructor must add a reviewed predicate first.
    if (typeof row.word !== "string" || row.word.length === 0
      || typeof row.reading !== "string" || !READING.test(row.reading)
      || row.entryId !== catalogEntryId(row.word, row.reading)
      || row.upos !== "NOUN" || row.role !== "classifier"
      || row.contextGate !== "numeric-classifier-v1"
      || evidence.authority !== "moe-revised-2021"
      || evidence.kind !== "dictionary-lexical-role-only"
      || evidence.reviewStatus !== "role-reading-reviewed"
      || typeof evidence.sourceUrl !== "string" || !SOURCE_URL.test(evidence.sourceUrl)) {
      throw new Error("unreviewed role, inconsistent reading identity, or unpinned dictionary evidence");
    }
    const identityKey = String(row.entryId) + "/" + String(row.upos) + "/" + String(row.role);
    const roleKey = String(row.word) + "/" + String(row.upos) + "/" + String(row.role);
    if (seenIdentities.has(identityKey) || seenRoleKeys.has(roleKey)) {
      throw new Error("conflicting or duplicated reading-role attestation: " + roleKey);
    }
    seenIdentities.add(identityKey);
    seenRoleKeys.add(roleKey);
    rows.push({
      word: row.word,
      reading: row.reading,
      entryId: row.entryId as string,
      upos: "NOUN",
      role: "classifier",
      contextGate: "numeric-classifier-v1",
      evidence: {
        authority: "moe-revised-2021",
        sourceUrl: evidence.sourceUrl,
        kind: "dictionary-lexical-role-only",
        reviewStatus: "role-reading-reviewed",
      },
    });
  }
  return {
    schemaVersion: "reviewed-reading-role-evidence-v1",
    purpose: input.purpose,
    rows: rows.sort((a, b) => a.entryId.localeCompare(b.entryId, "zh-Hant")),
  };
}

function contextGateAllows(
  row: ReviewedReadingRoleRow,
  profile: RuntimeSyntaxProfile,
  slot: StructuralLexicalSlot,
  previousEntry: CatalogEntry | null,
): boolean {
  switch (row.contextGate) {
    case "numeric-classifier-v1":
      return profile.upos === "NOUN"
        && slot.requiredFunctions.includes("classifier")
        && previousEntry !== null
        && NUMERAL.test(previousEntry.prompt.text);
  }
}

/**
 * Compile the entire verified manifest, not a list of hand-coded word tests.
 * Every row either uses a preexisting role profile or adds a new source-only
 * profile; no "best default" reading is inferred for the remaining words.
 */
export function compileReviewedReadingRoleProfiles(
  entries: readonly CatalogEntry[],
  sourceProfiles: readonly RuntimeSyntaxProfile[],
  manifest: ReviewedReadingRoleManifest,
): ReviewedReadingRoleProjection {
  const parsed = parseReviewedReadingRoleManifest(manifest);
  const byEntry = new Map(entries.map(e => [e.id, e]));
  if (byEntry.size !== entries.length) throw new Error("duplicate catalog entries");
  const grouped = new Map<string, RuntimeSyntaxProfile[]>();
  const seenProfileIds = new Set<string>();
  for (const profile of sourceProfiles) {
    if (seenProfileIds.has(profile.id) || !byEntry.has(profile.entryId)) {
      throw new Error("invalid input source profile identity");
    }
    seenProfileIds.add(profile.id);
    const key = profile.entryId + "/" + profile.upos;
    grouped.set(key, [...(grouped.get(key) ?? []), profile]);
  }
  const added: RuntimeSyntaxProfile[] = [];
  const rows: ReadingRoleProjectionRow[] = [];
  const profileIdsByAttestation = new Map<string, string>();
  const sourceRoleIdentity = new Map<string, ReviewedReadingRoleRow>();
  for (const row of parsed.rows) {
    const entry = byEntry.get(row.entryId);
    if (entry === undefined || entry.prompt.text !== row.word) {
      throw new Error("reviewed role reading absent from this catalog: " + row.entryId);
    }
    const source = grouped.get(row.entryId + "/" + row.upos) ?? [];
    if (source.length === 0) {
      throw new Error("reviewed reading has no source UPOS profile: " + row.entryId);
    }
    const existing = source.filter(p => p.functions.includes(row.role));
    const identity = {
      version: "reading-specific-source-role-v1",
      entryId: row.entryId, upos: row.upos, role: row.role,
      sourceUrl: row.evidence.sourceUrl,
    };
    const roleProfileId = SOURCE_PROFILE_PREFIX + sha256Canonical(identity);
    if (existing.length > 0) {
      rows.push({
        entryId: row.entryId, word: row.word, upos: row.upos, role: row.role,
        status: "existing-runtime-role",
        profileId: existing[0]!.id, sourceUrl: row.evidence.sourceUrl,
      });
    } else {
      if (seenProfileIds.has(roleProfileId)) throw new Error("duplicate source profile");
      seenProfileIds.add(roleProfileId);
      added.push({
        id: roleProfileId,
        entryId: row.entryId,
        upos: row.upos,
        functions: [row.role],
        valencyFrames: ["avalent"],
        dependencyEvidence: {
          dependencyRelationCounts: {},
          surfacePositionCounts: {},
        },
        provenanceIds: ["moe:revised-2021:" + row.evidence.sourceUrl.split("ID=")[1]!],
      });
      profileIdsByAttestation.set(roleProfileId, row.entryId);
      rows.push({
        entryId: row.entryId, word: row.word, upos: row.upos, role: row.role,
        status: "new-source-role-profile",
        profileId: roleProfileId, sourceUrl: row.evidence.sourceUrl,
      });
    }
    sourceRoleIdentity.set(row.word + "/" + row.upos + "/" + row.role, row);
  }

  const reportRows = rows.sort((a, b) => a.entryId.localeCompare(b.entryId, "zh-Hant"));
  const reportCore = {
    manifestRows: reportRows.length,
    existingRuntimeRoleRows: reportRows.filter(x => x.status === "existing-runtime-role").length,
    addedSourceRoleProfiles: added.length,
    rows: reportRows,
  };
  const result: ReviewedReadingRoleProjection = {
    profiles: [...sourceProfiles, ...added],
    report: {
      ...reportCore,
      determinismDigest: sha256Canonical(reportCore),
    },
    readingEligible: (entry, profile, slot, previousEntry) => {
      if (entry.id !== profile.entryId) return false;
      const sourceOnly = profileIdsByAttestation.get(profile.id);
      if (profile.id.startsWith(SOURCE_PROFILE_PREFIX)
        && sourceOnly !== entry.id) return false;
      if (sourceOnly !== undefined) {
        const sourceRow = parsed.rows.find(row => row.entryId === sourceOnly);
        if (sourceRow === undefined || !contextGateAllows(sourceRow, profile, slot, previousEntry)) {
          return false;
        }
      }
      // If the exact construction is active, reject competing pronunciations
      // within this written-word+UPOS group. No role condition => unchanged UD.
      for (const role of slot.requiredFunctions) {
        const row = sourceRoleIdentity.get(entry.prompt.text + "/" + profile.upos + "/" + role);
        if (row !== undefined && contextGateAllows(row, profile, slot, previousEntry)
          && entry.id !== row.entryId) return false;
      }
      return true;
    },
  };
  return result;
}
