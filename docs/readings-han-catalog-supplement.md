# Source-backed 和 hàn coordinator supplement

The catalog previously contained five 和 readings but omitted `和/ㄏㄢ4`.
The new identity is available for independently reviewed coordination practice,
alongside the existing `和/ㄏㄜ2` coordinator. All five earlier identities remain.

## Evidence and license boundary

[MOE Concised hàn](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19725)
points specifically to sense 7 of
[hé](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19016), the coordinating
usage. [MOE Revised 和](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4733)
also identifies hàn as the spoken pronunciation of the conjunction sense.
The separate directional preposition and other hé senses do not automatically
license hàn in every syntactic position.

The existing strict June archive adapters match these exact source rows:

| Identity | Concised bulk ID / physical row | Revised bulk ID / physical row |
| --- | --- | --- |
| 和/ㄏㄢ4 | 2771 / 19426 | 04883 / 4889 |
| 和/ㄏㄜ2 | 2677 / 18725 | 04721 / 4728 |
| 和/ㄏㄨㄛ4 | 2866 / 20054 | 05041 / 5048 |

The public metadata file `data/readings/moe-han-reading-source-evidence.json`
records archive checksums and exact-row definition fingerprints. It contains no
definitions and does not claim reviewed sense alignment. Bulk IDs are separate
from the online page IDs above. Original source definitions remain in ignored
local storage. Its SHA-256 is
`56a46d50b54fc2c7d518a5176f619b9daeb3907775784348fa96f0264fbb56c9`.

All three local GSD r2.18 files match the pinned source sizes and SHA-256 values.
The corpus contains 847 written occurrences of 和, all marked `Translit=hé`:

| UPOS | Source functions | Raw dependency counts |
| --- | --- | --- |
| CCONJ | coordinator | cc 769 |
| ADP | adposition, coordinator | case 73, cc 1 |
| NOUN | object | obj 1 |
| PROPN | modifier, unspecified | compound 1, flat:name 2 |

These are written-form syntax observations, not 847 hàn pronunciation labels.
The new identity inherits all four observed profiles without inventing roles.
Product eligibility permits only **CCONJ + coordinator + positive cc evidence**.
The mixed ADP/cc occurrence (`train-s1671`, token 28) makes checking UPOS
necessary; coordinator function or cc evidence alone is insufficient.
Other hàn roles remain context-required rather than globally declared incorrect.

The shared product policy applies this license in both ordinary and pre-draw
eligibility, including redraw paths. The shared construction identity table
admits hàn only with `coordinationType:coordination` and the same positive role
evidence. In particular, adding hàn cannot open the ADP relational-ccomp marker.
The existing hé coordinator and hé relational-ccomp marker remain eligible.
The current policy ID is `standard-han-coordination-trial`; prior final-stage
restrictions retain their order.

## Rebuild and preservation

The refreshed 160,000-candidate source projection and index retain their
existing digests:

- Source profiles: `c3cf2687cfa9d67b3f5aacd709f8765426296aeda0ce85522128d19b86e54913`.
- Source rule index: `f1b4c78dc96ad0bd8f446be372c3023dcb9b489630d32a2c99be37df194b8459`.

```sh
npx tsx scripts/build-lexicon-syntax-generation.ts --candidates data/generated/lexicon/naer-1141208-top-160000/candidates.csv --candidate-manifest data/generated/lexicon/naer-1141208-top-160000/manifest.json --evidence data/generated/lexicon/naer-1141208-top-160000/ud-evidence.json --profiles-output data/generated/han-catalog-supplement/syntax-profiles.json --rule-index-output data/generated/han-catalog-supplement/syntax-rule-index.json
npx tsx scripts/build-app-syntax-legality.ts --rule-index data/generated/han-catalog-supplement/syntax-rule-index.json --profiles data/generated/han-catalog-supplement/syntax-profiles.json --preserve-profile-order data/grammar/formal-syntax-active-catalog-profiles.json
```

Then refresh the existing morphology and seven occurrence-capability migrations
with `--write`, followed by `npm run app:catalog`. The grammar rules do not change.

The reviewed source catalog grows from 13,898 to 13,899 identities; the base
profile artifact grows from 16,267 to 16,271 profiles. The packaged catalog grows
from 13,693 entries / 16,062 profiles to **13,694 entries / 16,066 profiles**.
Its 205 grammar exclusions are unchanged. New shipped profile IDs 16062–16065
are appended; the CCONJ profile is `runtime-syntax-profile:16064`.

Comparison with the pre-addition snapshot confirms that all earlier catalog
entries, base profile contents and positions, shipped profile contents and IDs,
and occurrence-capability contents are unchanged. Sidecars refresh only their
profile-artifact lineage and determinism digest. Compact dependency evidence
uses positive presence values rather than the raw counts above.

NAER frequency remains written-form keyed: the new reading shares the same
frequency evidence as the five existing readings, and old frequency weights do
not change. The existing quantile contract recomputes cut points for the larger
catalog. This moves 草 from tier 1 to 2, 短期 from 2 to 3, and 甘草 from 3 to 4;
other old tier memberships are unchanged. These are catalog quantile effects,
not new source frequency observations.

## Historical replay scope

`READING_AUDIT_CATALOG=qian-catalog` reconstructs the b792f75 population by
omitting only hàn. `before-qian` omits both the qiān and hàn additions. Both modes
validate complete catalog and profile canonical hashes before sampling. Current
product audits use the enlarged population; targeted `current-product` probes
reject historical catalog overrides. Adding a candidate changes the sampling
population, so resulting lexical redraws must not be counted as pronunciation
repairs.

## Validation and observed availability

`npm run check:pr` passes 1,410 Vitest tests, 76 Python source-adapter tests,
type checking, catalog validation, production build and bundle size checks.
The current production asset is `index-BowdIpxD.js`, 481.58 kB gzip (decimal).
All 62 Chromium browser tests pass against that same build
(`npx playwright test --workers=2`).
The tests include actual ordered product selection of hàn, the mixed ADP/cc
negative case, identity mismatches, missing coordinator evidence, and preservation
of the hé coordinator and relational-ccomp marker.

Historical seed diagnostics explicitly use their original `before-qian`
population without changing the seeds or slot assertions. Current product
comparisons share the hàn pre-draw frontier before checking the other reading
repairs. Removing unlicensed alternatives can move a weighted draw's landing
point even when the old selected entry was itself licensed. Two captured current
seeds verify this effect separately: only slot zero changes, the remaining
entries/profiles and root are unchanged, and the full product matches that exact
frontier replay. This does not classify those redraws as pronunciation repairs.

The new 4,096-seed current-policy replay produces 4,096 successful sentences,
2,090 polyphonic occurrences and 132 observed ambiguous written forms. The new
hàn identity appears naturally 64 times, always as the licensed CCONJ profile;
hé remains observed 70 times across CCONJ, ADP and PROPN. A separately biased
probe also selects hàn through the actual ordered product policy. These are
availability observations, not independently adjudicated sentence naturalness
or pronunciation labels.

Compared with the previous 13,693-entry population and qian policy, 500 seeds
change lexical contents, with zero root or entry-count changes. Catalog addition
and scoped eligibility change the selection population; this is not a count of
500 pronunciation repairs. The full 4,096-seed qian historical replay reproduces
the earlier report byte-for-byte.

The current bounded identity audit finds 404 ambiguous identities across 182
forms: 196 observed in unbiased sampling, 103 only in targeted probes, 74 not
observed after three bounded probes, and 31 with every existing profile rejected
by role licensing. Non-observation is not proof of unreachability, and a retained
catalog identity does not by itself establish practice availability.

| Local artifact | SHA-256 |
| --- | --- |
| `han-catalog-supplement-check.json` | `0d63138012e76d87d900f05e327a225e23ab82ad0075f466d60cc824ce62dfcf` |
| `han-coordination-current.json` | `a0386a3ce11dda7a536da093c0c457073fbd58ac9394ab535799df76ed2dec34` |
| `han-qian-historical-recheck.json` | `8f6ca923b1e960ecd8c43b458c3deb62d64d5c709853091243d39e15372f7e69` |
| `han-catalog-exposure-diff.json` | `6661d16dfe4a3631eece47f8166b6e6d7c898b9e60d64e04a6c8ff26d527eb1f` |
| `han-targeted-current.json` | `da21256ad0697b0456f4bd89394cbd3edeed06aad66a406a1ded158b297bec2e` |
