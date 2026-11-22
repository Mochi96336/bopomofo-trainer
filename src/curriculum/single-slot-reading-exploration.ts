import type { CatalogEntry, RandomSource } from "../core/model.js";
import type { GrammarUtteranceCandidate } from "../grammar/types.js";
import type { StructuralLexicalSlot } from "../syntax/derive.js";
import {
  compatibleProfilesForSlot,
  realizeStructuralDerivationWithIndex,
  type LexicalProfileIndex,
} from "../syntax/realize.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { FormalSyntaxRealizationTrace, FormalSyntaxUtteranceInput } from "./formal-syntax-utterance.js";
import { weightedPick } from "./random.js";
import { PRODUCT_READING_POLICY } from "../readings/product-reading-policy.js";
import { excludeUnresolvedReadingGroups } from "../readings/reading-frontier.js";

type RoleReadingGate = NonNullable<FormalSyntaxUtteranceInput["readingEligibility"]>;
const originalGates: readonly RoleReadingGate[] = [
  PRODUCT_READING_POLICY.readingEligibility,
  PRODUCT_READING_POLICY.preDrawReadingEligibility,
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
  PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
];

function practiceSlot(slot: StructuralLexicalSlot): boolean {
  return slot.formalLiteral === undefined
    && !(slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT");
}
function keyFor(entry: CatalogEntry, profile: RuntimeSyntaxProfile): string {
  return JSON.stringify([entry.prompt.text, profile.upos]);
}
interface Substitute {
  readonly position: number;
  readonly profile: RuntimeSyntaxProfile;
  readonly entry: CatalogEntry;
  readonly compatibleIndex: number;
}
interface SubstituteTicket {
  readonly position: number;
  readonly entry: CatalogEntry;
  readonly profiles: Substitute[];
  readonly weight: number;
}

/**
 * Research-only one-slot substitution on the ALREADY CHOSEN product sentence.
 *
 * This is deliberately conservative:
 * - The original structural derivation and all other selected entries are fixed.
 * - Identity-bound A-not-A / repeated lexical positions are not touched.
 * - The new entry cannot duplicate any other written form in the sentence.
 * - Every original exact reading gate is rechecked against the new adjacency.
 * - Set-level reading abstention is lifted only for the one explicitly
 *   source-supported word+UPOS singleton, NOT all lexical roles in the sentence.
 * - No original product RNG, selection progress or grammar distribution is used.
 *
 * A dictionary POS singleton is still a review candidate and NOT a guarantee
 * that a rewritten sentence has a semantically appropriate pronunciation.
 */
export function trySingleSlotSourceReadingReplacement(input: {
  readonly baseline: GrammarUtteranceCandidate;
  readonly trace: FormalSyntaxRealizationTrace;
  readonly index: LexicalProfileIndex;
  readonly candidateRoleReadingIds: ReadonlyMap<string, string>;
  readonly random: RandomSource;
  readonly weight: (entry: CatalogEntry) => number;
}): {
  readonly candidate: GrammarUtteranceCandidate;
  readonly changedSlotIndex: number;
  readonly selectedEntryId: string;
  readonly eligibleReplacements: number;
} | null {
  const { baseline, trace, index } = input;
  if (baseline.id !== trace.realizationId
    || baseline.syntaxDerivationId !== trace.shape.id) {
    throw new Error("cannot apply a trace from a different finished sentence");
  }
  const slots = trace.shape.lexicalSlots.filter(practiceSlot);
  if (baseline.entries.length !== slots.length
    || baseline.syntaxProfileIds?.length !== slots.length) {
    throw new Error("original sentence and source shape lexical slots are misaligned");
  }
  const selectedProfiles: RuntimeSyntaxProfile[] = [];
  for (let at = 0; at < slots.length; at++) {
    const slot = slots[at]!;
    const profile = compatibleProfilesForSlot(slot, index)
      .find(p => p.id === baseline.syntaxProfileIds![at]);
    if (profile === undefined || profile.entryId !== baseline.entries[at]!.id) {
      throw new Error("original grammatical profile is not reproducible");
    }
    selectedProfiles.push(profile);
  }

  function validReplacement(at: number, proposed: RuntimeSyntaxProfile, replacement: CatalogEntry): boolean {
    const afterEntries = baseline.entries.map((item, index) => index === at ? replacement : item);
    const afterProfiles = selectedProfiles.map((item, index) => index === at ? proposed : item);
    // Only the replaced position and its immediate successor can have a
    // different selected entry or previous-entry context. Other frontiers
    // were already licensed by the original generator and stay identical.
    for (const index of [at, at + 1].filter(index => index < slots.length)) {
      const slot = slots[index]!;
      const previous = index === 0 ? null : afterEntries[index - 1]!;
      const entry = afterEntries[index]!;
      const profile = afterProfiles[index]!;
      if (!originalGates.every(gate => gate(entry, profile, slot, previous))) return false;
      const licensed = compatibleProfilesForSlot(slot, input.index).filter(p => {
        const e = input.index.entriesById.get(p.entryId);
        if (e === undefined || !originalGates.every(gate => gate(e, p, slot, previous))) return false;
        // Only the replacement slot gets the review-only singleton exception.
        if (index !== at) return true;
        const approved = input.candidateRoleReadingIds.get(keyFor(e, p));
        return approved === undefined || approved === e.id;
      });
      if (!excludeUnresolvedReadingGroups(licensed, input.index.entriesById)
        .some(p => p.id === profile.id)) return false;
    }
    return true;
  }

  // Same as the shipped lexical sampler: one weighted ticket per reading
  // identity in this position, not one ticket PER compatible syntax profile.
  // Otherwise an entry with several profiles borrows extra probability mass.
  const ticketBySlotAndEntry = new Map<string, SubstituteTicket>();
  for (let at = 0; at < slots.length; at++) {
    const slot = slots[at]!;
    // A bound slot must always be edited as a group, not individually.
    if (slot.entryBindingId !== undefined) continue;
    const compatible = compatibleProfilesForSlot(slot, index);
    for (let candidateIndex = 0; candidateIndex < compatible.length; candidateIndex++) {
      const profile = compatible[candidateIndex]!;
      const entry = index.entriesById.get(profile.entryId);
      if (entry === undefined) throw new Error("compatible profile references missing entry");
      if (input.candidateRoleReadingIds.get(keyFor(entry, profile)) !== entry.id) continue;
      if (entry.id === baseline.entries[at]!.id) continue;
      if (baseline.entries.some((existing, index) =>
        index !== at && existing.prompt.text === entry.prompt.text)) continue;
      if (!validReplacement(at, profile, entry)) continue;
      const key = JSON.stringify([at, entry.id]);
      let ticket = ticketBySlotAndEntry.get(key);
      if (ticket === undefined) {
        const weight = input.weight(entry);
        if (!Number.isFinite(weight) || weight < 0) throw new Error("invalid candidate lexical weight");
        if (weight === 0) continue;
        ticket = { position:at, entry, profiles:[], weight };
        ticketBySlotAndEntry.set(key, ticket);
      }
      ticket.profiles.push({ position:at, profile, entry, compatibleIndex:candidateIndex });
    }
  }
  const opportunities = [...ticketBySlotAndEntry.values()];
  if (opportunities.length === 0) return null;
  const ticket = weightedPick(opportunities.map(option=>({
    value:option, weight:option.weight,
  })), input.random);
  const unit = ticket.profiles.length === 1 ? 0 : input.random.next();
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) {
    throw new Error("invalid profile-selection random unit");
  }
  const selected = ticket.profiles[Math.floor(unit * ticket.profiles.length)]!;
  const offset = {
    ...trace.profileOffsetsBySlotId,
    [slots[selected.position]!.id]:selected.compatibleIndex,
  };
  const realization = realizeStructuralDerivationWithIndex(trace.shape,{
    index,profileOffsetsBySlotId:offset,punctuationToken:trace.punctuationToken,
  });
  if (realization === null || realization.entryIds.length !== baseline.entries.length
    || realization.syntaxProfileIds.length !== baseline.entries.length) {
    throw new Error("single-slot replacement failed to realize preserved grammar");
  }
  for (let at = 0; at < baseline.entries.length; at++) {
    if (at === selected.position) {
      if (realization.entryIds[at] !== selected.entry.id
        || realization.syntaxProfileIds[at] !== selected.profile.id) {
        throw new Error("targeted exact reading did not survive realization");
      }
    } else if (realization.entryIds[at] !== baseline.entries[at]!.id
      || realization.syntaxProfileIds[at] !== baseline.syntaxProfileIds![at]) {
      throw new Error("an unrelated lexical slot changed");
    }
  }
  const replaced = baseline.entries.map((entry,at)=>at===selected.position?selected.entry:entry);
  const sentence:GrammarUtteranceCandidate={
    ...baseline,id:realization.id,entries:replaced,
    syntaxDerivationId:realization.derivationId,
    syntaxProfileIds:realization.syntaxProfileIds,
    text:realization.tokens.filter(token=>token.kind==="lexical-entry")
      .map(token=>token.value).join(""),
  };
  if (sentence.id === baseline.id || sentence.syntaxRootRuleId !== baseline.syntaxRootRuleId
    || JSON.stringify(sentence.syntaxProductionRuleIds)
      !== JSON.stringify(baseline.syntaxProductionRuleIds)) {
    throw new Error("structural identity drift in lexical substitution");
  }
  return {
    candidate:sentence,changedSlotIndex:selected.position,
    selectedEntryId:selected.entry.id,eligibleReplacements:opportunities.length,
  };
}
