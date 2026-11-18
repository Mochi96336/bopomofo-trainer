import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { StructuralLexicalSlot } from "../syntax/derive.js";
import { numericClassifierContext } from "./numeric-classifier-reading.js";
import { sha256Canonical } from "../reference/importers/canonical-json.js";
import type {
  RuntimeSyntaxProfile, SyntacticFunction, Upos,
} from "../syntax/types.js";

/**
 * Research-only source-backed syntactic ROLE evidence per exact pronunciation.
 *
 * UD source profiles are keyed by written text and cannot identify a reading.
 * Adding a role to every homographic reading would falsely copy the evidence.
 * Instead attach a separate profile with no fabricated UD occurrences or
 * dependency relation counts. An exact construction context gate must ALSO
 * license the selected reading before delivery. Do not ship automatically.
 *
 * MOE Revised 2021:
 * 曲/ㄑㄩ3 https://dict.revised.moe.edu.tw/dictView.jsp?ID=6661
 * 號/ㄏㄠ4 https://dict.revised.moe.edu.tw/dictView.jsp?ID=4827
 */
export interface AttestedReadingRole {
  readonly word: string;
  readonly entryId: string;
  readonly upos: Upos;
  readonly role: SyntacticFunction;
  readonly evidence: {
    readonly authority: "moe-revised-2021";
    readonly sourceUrl: string;
    readonly evidenceKind: "dictionary-lexical-role-only";
    readonly contextualGate: "exact-number-plus-classifier-slot";
  };
}

export const EXPERIMENTAL_READING_ROLE_ATTESTATIONS: readonly AttestedReadingRole[] = [
  {
    word: "曲",
    entryId: catalogEntryId("曲", "ㄑㄩ3"),
    upos: "NOUN",
    role: "classifier",
    evidence: {
      authority: "moe-revised-2021",
      sourceUrl: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=6661",
      evidenceKind: "dictionary-lexical-role-only",
      contextualGate: "exact-number-plus-classifier-slot",
    },
  },
  {
    word: "號",
    entryId: catalogEntryId("號", "ㄏㄠ4"),
    upos: "NOUN",
    role: "classifier",
    evidence: {
      authority: "moe-revised-2021",
      sourceUrl: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=4827",
      evidenceKind: "dictionary-lexical-role-only",
      contextualGate: "exact-number-plus-classifier-slot",
    },
  },
];

export function projectAttestedReadingRoleProfiles(
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  attestations: readonly AttestedReadingRole[],
): readonly RuntimeSyntaxProfile[] {
  const entryById = new Map(entries.map(e => [e.id, e]));
  const extra: RuntimeSyntaxProfile[] = [];
  const seen = new Set<string>();
  const existingIds = new Set(profiles.map(p => p.id));
  for (const a of attestations) {
    if (seen.has(a.entryId + "/" + a.upos + "/" + a.role)) {
      throw new Error("duplicate reading-specific source attestation");
    }
    seen.add(a.entryId + "/" + a.upos + "/" + a.role);
    const entry = entryById.get(a.entryId);
    if (entry === undefined || entry.prompt.text !== a.word) {
      throw new Error("reading-specific attestation has no exact catalog identity: " + a.entryId);
    }
    if (a.evidence.authority !== "moe-revised-2021"
      || a.evidence.evidenceKind !== "dictionary-lexical-role-only"
      || a.evidence.contextualGate !== "exact-number-plus-classifier-slot"
      || !/^https:\/\/dict\.revised\.moe\.edu\.tw\/dictView\.jsp\?ID=\d+$/u.test(a.evidence.sourceUrl)) {
      throw new Error("unsupported or unpinned reading-role attestation");
    }
    const source = profiles.filter(p => p.entryId === a.entryId && p.upos === a.upos);
    if (source.length === 0) throw new Error("attestation has no runtime UPOS: " + a.entryId);
    if (source.some(p => p.functions.includes(a.role))) {
      throw new Error("reading-specific role already present: " + a.entryId);
    }
    const identity = {
      version: "source-only-reading-role-profile-experiment-v1",
      entryId: a.entryId, upos: a.upos, role: a.role,
      sourceUrl: a.evidence.sourceUrl,
    };
    const id = "attested-reading-role:" + sha256Canonical(identity);
    if (existingIds.has(id)) throw new Error("duplicate runtime profile ID");
    existingIds.add(id);
    extra.push({
      id,
      entryId: a.entryId,
      upos: a.upos,
      functions: [a.role],
      valencyFrames: ["avalent"],
      // No UD token has been assigned a pronunciation. Never invent clf=1.
      dependencyEvidence: {
        dependencyRelationCounts: {},
        surfacePositionCounts: {},
      },
      provenanceIds: ["moe:revised-2021:" + a.evidence.sourceUrl.split("ID=")[1]!],
    });
  }
  return [...profiles, ...extra];
}

/** A source-only profile never licenses itself outside its pinned construction. */
export function attestedReadingRoleProfileContextEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  slot: StructuralLexicalSlot,
  previousEntry: CatalogEntry | null,
): boolean {
  if (!profile.id.startsWith("attested-reading-role:")) return true;
  if (entry.id !== profile.entryId) return false;
  return EXPERIMENTAL_READING_ROLE_ATTESTATIONS.some(a =>
    a.entryId === entry.id && a.upos === profile.upos
      && profile.functions.length === 1
      && profile.functions[0] === a.role)
    && numericClassifierContext(entry, profile, slot, previousEntry);
}
