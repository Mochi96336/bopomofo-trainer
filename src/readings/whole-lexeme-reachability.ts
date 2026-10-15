import type { CatalogEntry } from "../core/model.js";
import type { GrammarUtteranceCandidate } from "../grammar/types.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";
import { reviewedRoleReadingEligible } from "./pronominal-role-license.js";

export interface HostLexemeReadiness {
  readonly hostLexeme: string;
  readonly exactEntryIds: readonly string[];
  readonly runtimeProfileIds: readonly string[];
  readonly licensedProfileIds: readonly string[];
  readonly licensedUpos: readonly Upos[];
  readonly status: "absent-from-catalog" | "no-runtime-profile" |
    "all-profiles-role-rejected" | "licensed-profile-present";
}

/** Whole catalog word identity; a matching substring is not a selected word. */
export function inspectHostLexemeReadiness(
  hostLexeme: string,
  catalog: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
): HostLexemeReadiness {
  if (hostLexeme.length < 2) throw new Error("host must be a multi-character lexeme");
  const hostEntries = catalog.filter(entry => entry.prompt.text === hostLexeme);
  const byId = new Map(hostEntries.map(entry => [entry.id, entry]));
  if (byId.size !== hostEntries.length) throw new Error("duplicate host catalog identity");
  const attachedProfiles = profiles.filter(profile => byId.has(profile.entryId));
  const licensedProfiles = attachedProfiles.filter(profile => {
    const entry = byId.get(profile.entryId);
    if (entry === undefined) throw new Error("profile/entry join failed");
    return reviewedRoleReadingEligible(entry, profile);
  });
  return {
    hostLexeme,
    exactEntryIds: [...byId.keys()].sort(),
    runtimeProfileIds: attachedProfiles.map(profile => profile.id).sort(),
    licensedProfileIds: licensedProfiles.map(profile => profile.id).sort(),
    licensedUpos: [...new Set(licensedProfiles.map(profile => profile.upos))].sort(),
    status: hostEntries.length === 0 ? "absent-from-catalog"
      : attachedProfiles.length === 0 ? "no-runtime-profile"
      : licensedProfiles.length === 0 ? "all-profiles-role-rejected"
      : "licensed-profile-present",
  };
}

export interface HostLexemeSelection {
  readonly atomicHostOccurrences: number;
  readonly hostEntryIds: readonly string[];
  readonly hostProfileIds: readonly (string | null)[];
  readonly surfaceOnlyCollision: boolean;
}

/** Inspect the actual lexical selection path, rather than the rendered string.
 * A selected 遊 + 說 is not an atomic selection of 遊說. */
export function inspectHostLexemeSelection(
  candidate: GrammarUtteranceCandidate,
  host: HostLexemeReadiness,
  profilesById: ReadonlyMap<string, RuntimeSyntaxProfile>,
): HostLexemeSelection {
  if (candidate.syntaxProfileIds !== undefined
    && candidate.syntaxProfileIds.length !== candidate.entries.length) {
    throw new Error("candidate entry/profile alignment mismatch");
  }
  const entryIds = new Set(host.exactEntryIds);
  const selected: string[] = [];
  const profileIds: (string | null)[] = [];
  candidate.entries.forEach((entry, index) => {
    if (!entryIds.has(entry.id)) return;
    if (entry.prompt.text !== host.hostLexeme) throw new Error("selected entry/host lexeme mismatch");
    const profileId = candidate.syntaxProfileIds?.[index] ?? null;
    const profile = profileId === null ? undefined : profilesById.get(profileId);
    if (profileId !== null && (profile === undefined || profile.entryId !== entry.id)) {
      throw new Error("selected host profile/entry identity mismatch");
    }
    selected.push(entry.id);
    profileIds.push(profileId);
  });
  return {
    atomicHostOccurrences: selected.length,
    hostEntryIds: selected,
    hostProfileIds: profileIds,
    surfaceOnlyCollision: selected.length === 0 && candidate.text.includes(host.hostLexeme),
  };
}
