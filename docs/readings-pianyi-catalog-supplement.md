# Source-backed 便宜 pián yí catalog supplement

The catalog previously contained `便宜/ㄆㄧㄢ2 ㄧ5` and
`便宜/ㄅㄧㄢ4 ㄧ2`, but omitted the full-tone Taiwan Concised reading
`便宜/ㄆㄧㄢ2 ㄧ2`. This supplement adds the missing exact identity while
retaining both earlier readings.

## Reading and syntax evidence

[MOE Concised 便宜/pián yí](https://dict.concised.moe.edu.tw/dictView.jsp?ID=3179)
lists the full-tone reading for the low-price and benefit senses. Its separate
[biàn yí entry](https://dict.concised.moe.edu.tw/dictView.jsp?ID=1634) means
convenient or appropriate. MOE Revised represents the low-price and benefit
senses with a neutral second syllable instead. These are distinct exact source
rows, not a guessed tone conversion.

The strict June archive adapters find:

| Identity | Concised bulk ID / physical row | Revised bulk ID / physical row |
| --- | --- | --- |
| ㄆㄧㄢ2 ㄧ2 | 047300002 / 3148 | no exact main-row match |
| ㄆㄧㄢ2 ㄧ5 | no exact main-row match | 009200007 / 25163 |
| ㄅㄧㄢ4 ㄧ2 | 024500018 / 1609 | 004930077 / 18839 |

The committed metadata file
`data/readings/moe-pianyi-reading-source-evidence.json` contains the archive
pins, exact rows, and definition fingerprints without definitions. Its SHA-256
is `0654484fac7dadc78a2f54fe656655a85f94f8185dbd207f70f99d0db0042c5e`.
Bulk IDs are not online dictionary page IDs. Original definitions remain in
ignored local storage.

Pinned GSD r2.18 contains three written occurrences of 便宜. Their contexts are
the low-price sense: two ADJ modifier occurrences (`train-s7`, `train-s2277`)
and one ADJ clausal-subject occurrence (`train-s3936`). GSD transliteration is
not treated as an independent pronunciation label. The new identity reuses the
observed whole-word ADJ profile rather than inventing a role:

- runtime profile `runtime-syntax-profile:16066`;
- functions `modifier`, `subject`;
- compact positive evidence `amod: 1`, `csubj: 1`.

The same syntax-bearing fields are retained for both existing identities. No
new policy gate is necessary: this is an exact whole-word reading for the same
dictionary sense and observed role, rather than a bound reading or a reading
licensed only under a special construction.

## Rebuild and preservation

The 160,000-candidate source projection and rule index retain their existing
digests:

- source profiles: `c3cf2687cfa9d67b3f5aacd709f8765426296aeda0ce85522128d19b86e54913`;
- source rule index: `f1b4c78dc96ad0bd8f446be372c3023dcb9b489630d32a2c99be37df194b8459`.

```sh
npx tsx scripts/build-lexicon-syntax-generation.ts --candidates data/generated/lexicon/naer-1141208-top-160000/candidates.csv --candidate-manifest data/generated/lexicon/naer-1141208-top-160000/manifest.json --evidence data/generated/lexicon/naer-1141208-top-160000/ud-evidence.json --profiles-output data/generated/pianyi-catalog-supplement/syntax-profiles.json --rule-index-output data/generated/pianyi-catalog-supplement/syntax-rule-index.json
npx tsx scripts/build-app-syntax-legality.ts --rule-index data/generated/pianyi-catalog-supplement/syntax-rule-index.json --profiles data/generated/pianyi-catalog-supplement/syntax-profiles.json --preserve-profile-order data/grammar/formal-syntax-active-catalog-profiles.json
```

After refreshing morphology and the seven existing occurrence-capability
sidecars, the reviewed source catalog grows from 13,899 to 13,900 identities;
the base profile artifact grows from 16,271 to 16,272. The packaged catalog
grows from 13,694 entries / 16,066 profiles to **13,695 entries / 16,067
profiles**. Its 205 executable-grammar exclusions are unchanged.

Snapshot comparison confirms that every older catalog entry, base profile
position and content, shipped profile ID and content, and capability payload is
unchanged. Capability sidecars refresh only their source-profile lineage and
determinism digest. The new profile is appended after all old compact IDs.

NAER frequency remains written-form keyed. The new reading shares the same
frequency evidence as both earlier identities. Recomputing the catalog quantile
cut points moves only `齣/ㄔㄨ1` from tier 2 to tier 3; this is not new source
frequency evidence.

## Replay and availability

`npm run check:pr` passes 1,413 Vitest tests, 76 Python source-adapter
tests, type checking, catalog validation, production build, and bundle size
checks. All 62 Chromium tests pass against the same production build. The
current JavaScript asset is `index-DjAmsOWC.js`, 481.50 kB gzip (decimal).

The new 4,096-seed current-policy replay generates every sentence successfully.
The full-tone identity appears naturally once with its ADJ profile; the two
existing readings also remain observed. A bounded targeted probe selects the new
identity through the actual ordered product policy. These observations establish
availability, not independently adjudicated sentence naturalness.

Adding the candidate changes 185 of 4,096 lexical samples, with zero syntax-root
or entry-count changes. These are population-induced redraws, not 185 reading
repairs. `READING_AUDIT_CATALOG=han-catalog` reconstructs the 9d8f1e0 population
by excluding only the new identity and verifies full catalog/profile hashes. Its
4,096-seed report reproduces the previous hàn report byte-for-byte.

The current bounded identity audit contains 405 ambiguous identities across 182
forms: 197 observed in unbiased sampling, 104 only in targeted probes, 73 not
observed after three bounded probes, and 31 whose existing profiles are all
rejected by role licensing. Non-observation does not prove unreachability.

| Local artifact | SHA-256 |
| --- | --- |
| `pianyi-catalog-supplement-check.json` | `2322202ff730abeb64b1e7486025544b0f61e759b258512e180921296102d1ed` |
| `pianyi-current.json` | `a0c4e049b186d9b60392be5ae752531fcd2319c3daa568ebbc9b751b1c793e60` |
| `pianyi-han-historical-recheck.json` | `a0386a3ce11dda7a536da093c0c457073fbd58ac9394ab535799df76ed2dec34` |
| `pianyi-catalog-exposure-diff.json` | `098c2e573cbd71fa124cff5302a6c8ce8d33e61074b75b6554d509378863eec7` |
| `pianyi-targeted-current.json` | `64d10b4c3f7a49dca2a51f166d16497b13704f6a4ec7057142fabe8c24554414` |

## Reviewed leads not activated in this batch

The other inventory leads were not bulk-added:

- `比/ㄆㄧ2` is a bound reading referring to 皋比. `比/ㄅㄧ4` is an independent
  reading, but the current unpronounced written-form profiles chiefly represent
  modern comparative uses. Inheriting those profiles would produce unsupported
  four-tone comparison practice.
- `姑娘/ㄍㄨ1 ㄋㄧㄤ2` means “aunt” in the cited regional usage, while the
  existing neutral-tone profile comes from the “young woman” word. Sharing that
  profile would erase the sense distinction.

Both remain catalog coverage leads that require an exact bound expression or
independently supported practice context.
