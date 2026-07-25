# Commonness projection v1

Status: product-facing projection contract. The source-specific NAER column mapping remains gated by Issue #44.

## Purpose

The practice selector needs a continuous commonness base without importing NAER-specific workbook fields into curriculum code. `commonness-v1` converts reviewed spoken and written frequency evidence into a source-neutral `CatalogCommonnessBase`. It is the only notion of how common a word is: there is no coarse band beside it.

## Input boundary

Every evidence record identifies exactly one reviewed catalog entry and preserves:

- source ID and source version;
- source row identity;
- spoken frequency per million, including a true numeric zero;
- written frequency per million, including a true numeric zero;
- identity review status.

`null` means missing. `0` means an observed zero. They are never interchangeable.

The projection excludes:

- unresolved catalog identities;
- negative or non-finite frequencies;
- rows with both frequency channels missing;
- duplicate evidence for one catalog identity;
- one source row mapped to more than one catalog identity, *unless* every one
  of those identities shares the same catalog text -- that shape is a
  reviewed heteronym (several active readings for one hanzi), and the source
  row's frequency figure describes the written/spoken word regardless of
  which reading is practiced, so it is intentionally donated to every
  reading variant rather than excluded.

This still rejects the case the original rule was meant to catch: one source
row accidentally mapped to genuinely different, unrelated catalog texts.

## Normalization

For each available channel, v1 derives its maximum from the accepted reviewed identity set and applies:

```text
strength = log(1 + value) / log(1 + channel maximum)
```

When the accepted channel maximum is zero, every observed value in that channel receives strength `0`.

The model combines available channels using:

- spoken weight: `0.60`;
- written weight: `0.40`.

When only one channel is present, the available weight is renormalized rather than treating the missing channel as zero.

The raw score remains in `[0, 1]`. Selection uses:

```text
selectionWeight = 0.05 + score × 0.95
```

This keeps an observed zero selectable at a very low rate while preserving `score = 0` in the evidence record.

## Product seam

`CatalogEntry.commonnessBase` is optional. Curriculum code reads `selectionWeight` when present; an entry without it weighs `1`, so a catalog with no evidence at all selects uniformly.

The contract is source-neutral. NAER adapter types and workbook header names must remain under the reference/import boundary and must not enter curriculum modules.

## Displayed tiers

`selectionWeight` also drives what the learner sees, in exactly one place. The practice stage stays clean; the settings dialog carries a `等級` reading at the right of its header, drawn as four marks lit from the most common end -- one lit for the most common tenth, four for the rarest half. The frame keeps four marks at every level so the header does not shift around it.

The reading is the current sentence's *rarest* word, not its most common one. Selection is already weighted towards common words, so on a 300-sentence sample 89% of sentences contained a tier-1 word and a "most common" reading would sit at one mark almost always; the rarest word spreads across 4/12/29/55% and is what makes a sentence hard.

Tiers are cut by share of the packaged catalog, not by weight value:

- tier 1 -- the most common 10%;
- tier 2 -- up to 25%;
- tier 3 -- up to 50%;
- tier 4 -- the remaining half.

The value cuts are computed at catalog compile time from the weights actually shipped and emitted as `COMMONNESS_TIER_THRESHOLDS`, so a model or source-version change moves the cuts with the data instead of leaving fixed numbers behind. Value-width bands would not work here: the normalization is logarithmic, so the shipped catalog's median weight sits near `0.18` while only about 4% of entries reach `0.5`, and equal-width bands would place nearly every word in one band.

An entry without reviewed evidence has no tier and no marks. It has no measured position in the catalog, and drawing it as the rarest tier would state something the evidence does not.

Tiers never gate selection. Analysis code also stratifies by them -- the relational partition policy `commonness-stratified-v1` and its `commonnessTierDivergence` metric -- through `catalogCommonnessTiers`, which is total where the display projection is not.

## Determinism

Evidence is sorted by catalog identity and source identity before projection. Accepted entries and exclusions use canonical ordering. Output includes a SHA-256 digest of the complete projection payload before the digest field is added.

The same evidence set, model configuration, identity decisions, and source version therefore produce byte-for-byte identical serialized output.

## Deferred work

This model does not include:

- domain breadth;
- pedagogical level;
- cross-source agreement;
- automatic catalog approval;
- claims that corpus frequency alone determines teaching value.

The exact NAER source-column mapping, checksum, and reviewed structural report remain part of Issue #44. The source adapter and local projection command remain part of Issue #45.
