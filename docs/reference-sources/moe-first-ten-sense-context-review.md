# First ten polyphonic sense-context cases (proposals, not runtime rules)

This pilot is **not a new pronunciation filter**. It only makes the next
linguistic review reproducible after #408-#410 identified both source
dictionary entries, read source definitions privately, and pinned the
official September 2026 archives.

The structured review queue is
`data/readings/moe-20260929-pilot-context-hypotheses.json`.

Every row records:

- exact packaged practice catalog entry ID (text **and** reading),
- two previously verified MOE source entry identifiers (Concised and Revised),
- an **original, newly authored** usage illustration (not copied from MOE),
- a **hypothesis** about the sense and whether the reading is isolated or part
  of a larger phrase,
- four separate `pending` review decisions: dictionary sense, contextual
  pronunciation, grammatical role and sentence naturalness.

The source identifiers are traceable to the sanitized metadata downloaded
from GitHub Actions #410, backed by the strict SHA-256 pins in
`data/readings/moe-20260929-sense-source-pins.json`. This file contains
**no dictionary definitions or MOE copied examples**.

## Lexical identity is not automatically whole-phrase evidence

These are especially important counterexamples to a naïve surface-POS gate:

- **說 ㄕㄨㄟ4**: an authentic sense appears in a compound such as
  `遊說`. Evidence for that compound does not authorize drawing an isolated
  `說` with the rare reading in arbitrary VERB slots.
- **給 ㄐㄧ3**: expressions such as `自給自足` or `補給` need analysis
  of their compound lexical identity, rather than setting a universal
  `給/VERB` reading.
- **為 ㄨㄟ2** in `成為`: the compound supplies one attested use but
  does not disambiguate every standalone `為`.

Other reviewed examples need grammar, not just neighboring character rules:

- `這種花` versus `我想種花` (different noun/classifier versus verb usage)
- `街道呈東西走向` versus `我買了一些東西` (direction vs. object,
  with a light-tone distinction).

Even a seemingly clear example remains only a **candidate** in the dataset
until a reviewer checks the source definition plus the actual syntax and
naturalness. These authored sentences MUST NOT be used as automatically
approved model training labels.

## Approval boundary

Before a reviewed rule can enter the product, require all of:

1. The exact source entry is verified against the pinned SHA-256 source.
2. The reading-to-sense distinction is supported independently of synthesized
   syntax output; do not equate a shared UD surface profile with a sense.
3. The target span and lexical segmentation/compound boundary are resolved.
4. Valid alternative readings and counterexamples are tested.
5. The three-valued reading decision (`accept/reject/unknown`) abstains when
   sense evidence is not decisive.
6. Confirm unchanged licensed seed selection, generated coverage, all
   commonness tiers and browser performance against current baseline.

The existing `reviewedRoleReadingEligible` policy is already active in the
product. This new file is strictly offline research and **does not activate
a lexical sense classifier**.

## Authoritative external usage checks

Compare the questions against the MOE public dictionary (without shipping
definitions):

- `種` / ㄓㄨㄥ3: https://dict.concised.moe.edu.tw/dictView.jsp?ID=31268
- `說` / ㄕㄨㄟ4: https://dict.concised.moe.edu.tw/dictView.jsp?ID=35731
- `東西` / light tone: https://dict.concised.moe.edu.tw/dictView.jsp?ID=9787
- `給` / ㄐㄧ3: https://dict.concised.moe.edu.tw/dictView.jsp?ID=21535

The live dictionary pages are supplementary reading references, not substitutes
for the downloaded, SHA-pinned source rows or independent contextual review.
