# Source-backed 嵌 qiān catalog supplement

The previous catalog contained `嵌/ㄎㄢ3` and `嵌/ㄑㄧㄢ4`, but omitted the
ordinary embedding reading `嵌/ㄑㄧㄢ1`. This addition retains both existing
identities and adds the missing exact reading with MOE provenance.

## Reading and syntax evidence

[MOE Concised 嵌](https://dict.concised.moe.edu.tw/dictView.jsp?ID=25109)
identifies qiān for embedding. Its separate [kǎn entry](https://dict.concised.moe.edu.tw/dictView.jsp?ID=18430)
points to 赤嵌樓. [MOE Revised 嵌](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4522)
separates embedding qiān, the qiàn adjective and the bound place-name kǎn.
This does not establish arbitrary full-sentence pronunciation labels.

The pinned June source adapters independently matched the three exact readings:

| Reading | Concised bulk ID / physical row | Revised bulk ID / physical row |
| --- | --- | --- |
| ㄑㄧㄢ1 | 3654 / 24724 | 06447 / 6455 |
| ㄑㄧㄢ4 | absent in this projection | 06489 / 6498 |
| ㄎㄢ3 | 2558 / 18147 | 04510A / 4517 |

Metadata and fingerprints are committed in
`data/readings/moe-qian-reading-source-evidence.json`, SHA-256
`ca5350745d4a17ccb557ab54f078672518c127648f21c9dcb7ef44c02f713bd5`.
Original definitions remain private under ignored `data/external/`. These bulk
IDs must not be converted into online dictionary page URLs.

The new identity reuses the already observed exact-form UD profile, not a guessed
new role: VERB, transitive, with `xcomp: 1` and `parataxis: 1` evidence.
The source profile is
`syntax-profile:7f19031ed6675ed77a793fb9bf7db0d3f3e0c9d8bb69c70eedf2502574b1965d`;
the new bound runtime source profile is
`runtime-syntax-profile:97add0d9113bde0edc21802f17d0ed20a73b2838b0a399c8dbd39290baf53d94`.
Dictionary reading attestation and written-form syntax evidence remain distinct.

## Rebuild and preservation boundary

The current projection was regenerated from the existing manifest-linked
160,000-candidate inputs, using the current projector and grammar. Its profile
projection digest remains the existing
`fa54405dba58422be461fffb59e99d6718e376492d93af34ddbe79f5005e1efe`.
The refreshed source index digest is
`f1b4c78dc96ad0bd8f446be372c3023dcb9b489630d32a2c99be37df194b8459`.
The grammar-rules digest is unchanged.

```sh
npx tsx scripts/build-lexicon-syntax-generation.ts --candidates data/generated/lexicon/naer-1141208-top-160000/candidates.csv --candidate-manifest data/generated/lexicon/naer-1141208-top-160000/manifest.json --evidence data/generated/lexicon/naer-1141208-top-160000/ud-evidence.json --profiles-output data/generated/qian-catalog-supplement/syntax-profiles.json --rule-index-output data/generated/qian-catalog-supplement/syntax-rule-index.json
npx tsx scripts/build-app-syntax-legality.ts --rule-index data/generated/qian-catalog-supplement/syntax-rule-index.json --profiles data/generated/qian-catalog-supplement/syntax-profiles.json --preserve-profile-order data/grammar/formal-syntax-active-catalog-profiles.json
```

Refresh morphology and the seven occurrence-capability artifacts with their
existing `--write` migrations before `npm run check:pr`. The source index excludes
206 identities before reviewed runtime capabilities; current product packaging
excludes 205 after those capabilities. Keeping all observed base profiles is
necessary to preserve that legitimately recovered entry.

The compiled source catalog grows from 13,897 to 13,898 identities, its base
profiles from 16,266 to 16,267, and the shipped catalog from 13,692 to 13,693
entries / 16,062 profiles. Every old catalog entry, source profile identity,
syntax-bearing profile field and existing occurrence capability was checked
against the pre-addition snapshot and retained. New profiles are appended to the
prior validated profile order, preserving old compact IDs.

NAER evidence remains written-form keyed. All three 嵌 identities share the same
frequency record; no old word's frequency weight changes. The catalog-based
quantile cut points are recomputed by the existing contract. This moves 短期
from tier 3 to tier 2 and 甘草 from tier 4 to tier 3; other old tier memberships
are unchanged. This is a consequence of adding one catalog identity, not a
change to source frequency evidence.

## Validation and catalog versions

`npm run check:pr` passed 1,387 Vitest tests, 76 Python source-adapter tests,
type checking, catalog validation, production build and the bundle budget.
All 62 Chromium tests passed against the same production asset
`index-Dn5wpS4T.js`; JavaScript gzip size is 481.20 kB (decimal).

A current-catalog 4,096-seed `standard-role-extended-trial` replay completed with
zero generation failures. The new qiān identity appeared naturally at seed
24/slot 3 and 2257/slot 3, and a separate bounded targeted probe also selected it.
These observations prove selection availability, not independently adjudicated
whole-sentence pronunciation or naturalness.

Adding a candidate changes the sampling population: 166 seeds differ from the
pre-addition replay (74 in its first half), with zero root or entry-count changes.
These are catalog-induced redraws, not 166 pronunciation repairs. Polyphonic
occurrences change from 2,062 to 2,058, with 131 ambiguous written forms observed
in each population. The old compact profile IDs are preserved; old source
profile and catalog-entry contents were independently checked unchanged.

| Local artifact | SHA-256 |
| --- | --- |
| `qian-catalog-stable-exposure.json` | `5c1bd8c8770669d671650ec673149f8f2f5dab1dbd264642f6b7a2bd5058beb4` |
| `qian-catalog-stable-diff.json` | `e054f94572b4dd10d29760df10e7954926d8009fe497c78e608053c645eadf8b` |
| `qian-catalog-supplement-check.json` | `41c9f0ffe944f24e35d5c270de60bbbaadb3ee98c2bcaefc76899710df261355` |

Historical role comparisons require their original population. The existing
historical exposure workflow explicitly sets `READING_AUDIT_CATALOG=before-qian`.
`reading-audit-catalog.ts` reconstructs the be37cac catalog by omitting this one
addition, then verifies complete catalog and profile fingerprints; mismatches
fail closed. It does not change product inputs. Outside that historical job the
audits default to the current catalog, and `current-product` targeted probes
reject the historical override.

The full 4,096-seed historical replay was also rerun under that override and
reproduced the original report byte-for-byte, SHA-256
`c1f2c6cdc468a1d409625ec8b0e2a5aeacad8050da7d0a11e6e39ffdc4d6e2d3`.

```powershell
$env:READING_AUDIT_CATALOG = 'current'
npx tsx scripts/audit-polyphonic-context.ts --samples 4096 --policy standard-role-extended-trial --output data/generated/qian-catalog-stable-exposure.json
```

## Scope still pending

Adding qiān does not by itself license the existing qiàn or kǎn entries as
independent verbs. Their contextual restrictions require a separate controlled
comparison on the enlarged catalog. Bound place-name and adjective readings
remain valid dictionary identities and must not be deleted to hide that gap.

The same source review confirmed two legitimate rare cases to preserve:
[藏/cáng](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9592) is an attested
surname, and [弟/tì](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2653) has
a genuine ethical-concept NOUN sense as well as VERB/ADV uses. Their unfamiliar
PROPN/NOUN exposures are not grounds for a new blanket rejection.
