# MOE five-word sense evidence pilot (offline only)

**Status: source-attestation pipeline, not sense approval.** Covers active
pronunciation identities of `種`, `說`, `東西`, `給` and `為`. The goal is
to safely inspect actual Taiwanese MOE dictionary entries before any
meaning-based reading gate is designed. No browser bundle, grammar sampler,
learner progress, or scoring logic uses this pilot.

## Why a separate adapter?

The existing `project-moe-concised-readings.py` and
`project-moe-revised-readings.py` deliberately accept unambiguous
*single-reading* headwords, and report ambiguous ones rather than choosing.
Their committed JSON projections omit `釋義` entirely and cannot reconstruct
lexical sense. The pilot reuses the original adapters' strict archive/workbook
hashes, worksheet/header checks, and Bopomofo conversion, but matches all
exact `(written form, reading)` source rows.

A dictionary entry matched by pronunciation is still **not automatically a
reviewed sense**. The same headword+reading can have more than one dictionary
entry/sense, and a different dictionary may use different granularity. Every
entry stays `senseReviewStatus: unreviewed` until independent review.

## Local workflow

Requires the **pinned 2026-06-26 Concised** and **2026-06-25 Revised** ZIPs
under ignored `data/external/`. Do not use a newer source with old SHA-256
constants. The official download pages currently advertise a 2026-09-29
revision, which needs a separate version/schema/diff audit.

```bash
npm run app:catalog
npm run readings:sense-targets

npm run readings:moe-sense -- \
  --concised data/external/moe/concised/2014_20260626/source.zip \
  --revised data/external/moe/revised/2015_20260625/source.zip
```

The tool writes:

- **Public-safe source index**:
  `data/generated/moe-sense-pilot-source-index.json` (also ignored).
  Per reading identity, records matching source entry IDs, row numbers,
  source versions, source readings, definition presence and SHA-256 digests.
  Does **not** contain dictionary definition text or original examples.
- **Private local review file**:
  `data/external/moe/sense-pilot/private-review.json` (gitignored).
  Contains the exact source definitions for review. Never upload, commit,
  distribute as an automated artifact, or embed in the app.
- **Target manifest**:
  `data/generated/moe-sense-pilot-targets.json`. Built from real packaged
  `PRACTICE_CATALOG` entry IDs, not provisional CSV rows or guessed readings.
  CI runs this manifest check **without** external dictionary downloads.

Both source ZIPs are locally checksum-verified against the existing pinned
adapters. Missing or unsupported readings remain `no-exact-source-reading`,
not "invalid"; multiple exact source rows remain
`multiple-source-rows-review-required`, not silently merged.

## Review protocol for first five forms

For each exact reading ID, review a **native real usage** separately from
artificially sampled Syntax V2 contexts and keep distinct judgments for:

1. source reading/entry identity (`matched` vs `not matched`);
2. lexical **sense** (`reviewed` only with a specific source entry ID);
3. genuine syntax role/argument relationship (`supported` vs `uncertain`);
4. contextual pronunciation correctness;
5. sentence naturalness.

Examples to distinguish in independent human review include whether `種`
denotes a class or an act of planting, `說` is speaking or persuading,
`東西` denotes directions or objects (including neutral-tone behavior),
`給` varies by sense, and `為` varies by grammatical and semantic role.
These are prompts for review, **not labels inferred from the dictionary
headword alone**.

A later, separately reviewed compact rule file can record our own context
constraints (e.g. a specific construction that licenses a precise reading)
with links back to source IDs. It must never repackage edited MOE definitions.

## Rights and source version

The Ministry of Education dictionary public-authorization download pages
label their content CC BY-ND 3.0 TW, require attribution and compliance with
the official usage instructions, and prohibit modification of original entries.
The official dictionary FAQ also describes restrictions on app integration;
do not treat source availability as carte blanche for redistribution.
This pilot intentionally keeps original `釋義` **private/offline**, with
public outputs containing only entry metadata and digests. Review distribution
and the applicable usage rules before shipping any derived artifact.

- https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html
- https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_reviseddict_download.html
- https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/index.html

The research adapter is not a live dictionary API and makes no network
requests. Test fixtures use synthetic, clearly marked dummy definitions.
