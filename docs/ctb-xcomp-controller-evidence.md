# Local CTB xcomp controller evidence probe

## Why this probe exists

The current Formal Syntax V2 grammar distinguishes subject-control and object-control `xcomp` shapes, but the pinned `UD_Chinese-GSD r2.18` source cannot type the controller. Its basic trees contain `xcomp`; its reviewed data does not provide the Enhanced UD `nsubj:xsubj` controller edge needed to identify which matrix argument controls the embedded subject.

Penn Chinese Treebank (CTB) supplies a different source-native signal. The official bracketing guidelines define `(-NONE- *PRO*)` as the null subject used in control constructions and distinguish subject-control from object-control structures. Importantly, the guideline contains **both indexed and unindexed `*PRO*` examples**. Some subject-control examples coindex `*PRO*-N` with the matrix subject, and some object-control examples coindex `*PRO*-N` with the matrix object; other valid control examples leave `*PRO*` unindexed.

Therefore this probe does **not** treat CTB as a complete controller-labelled gold source. It uses only the explicitly coindexed subset as high-confidence controller-typed evidence and keeps unindexed control-looking structures unresolved. Full-source measurement is required to discover how much of CTB 9.0 is actually recoverable under that narrow contract.

References:

- CTB bracketing guideline: <https://catalog.ldc.upenn.edu/docs/LDC2011T03/treebank/chinese-treebank-parses.pdf>
- Chinese Treebank 9.0 catalog entry: <https://catalog.ldc.upenn.edu/LDC2016T13>
- UD Enhanced Dependencies controller convention: <https://universaldependencies.org/u/overview/enhanced-syntax.html>

## Licensing boundary

CTB 9.0 (`LDC2016T13`) is an LDC-distributed licensed corpus. This repository does **not** download, vendor, redistribute, or commit CTB source text.

The probe accepts only a caller-supplied local source directory. `data/external/` is already gitignored, so a licensed local copy may be placed there if desired, but the probe does not require a repository-local path.

## Evidence contract

The probe uses the contract `ctb-ip-obj-pro-coindex-controller-v1`.

A controller type is projected only when all structural conditions below hold:

1. the embedded subject contains `(-NONE- *PRO*-N)` with an explicit identity index;
2. that null element is inside `NP-SBJ`;
3. the embedded clause is an `IP-OBJ` selected directly by a matrix `VP`;
4. exactly one matrix argument outside the embedded IP carries the same identity index `N`;
5. `NP-...-SBJ-N` classifies subject control;
6. `NP-...-OBJ-N` classifies object control.

A structurally selected `IP-OBJ` with unindexed `*PRO*` is still counted as a control candidate, but its controller is `unresolved`. Zero or multiple same-index matrix arguments also fail closed as `unresolved`. This deliberately forbids both of these shortcuts:

- no matrix object -> subject control;
- matrix object present -> object control.

The typed subject/object counts are therefore a **recoverable indexed subset**, not an estimate of all subject-control/object-control constructions in CTB. `unindexedProCount` is a required coverage diagnostic and must be reviewed before any runtime projection is proposed.

`IP-ADV`, `IP-SBJ`, and other non-`IP-OBJ` PRO clauses are not counted as xcomp-controller candidates. This prevents arbitrary, subject, or adjunct control structures from being projected into the lexical open-complement capability.

For a later lexical projection, the probe also records whether the selected matrix VP exposes exactly one direct `VV` head. Subject/object observations without that head remain controller-typed evidence but are excluded from the `projectable*ControllerCount` fields.

## Public UD fallback audit

A public-source audit on 2026-09-15 found no `xsubj` controller edges in the available Chinese UD alternatives checked (GSD, GSDSimp, PUD, HK, CFL, Beginner, and PatentChar repository search; direct CoNLL-U checks were also made for PUD, HK, Beginner, and CFL). Basic `xcomp` is therefore not being substituted for controller-typed evidence.

This is a negative result only: it does not prove that no future Chinese UD release can add enhanced controller annotation. Any future public replacement must be reviewed from its actual enhanced dependency contract and pinned source version.

## Running the probe

With a legally licensed CTB 9.0 bracketed tree directory available locally:

```bash
python scripts/audit-ctb-xcomp-controller-evidence.py \
  --source-dir data/external/ctb/9.0
```

The default recursive file pattern is `*.fid`. A different layout can be inspected with `--glob`:

```bash
python scripts/audit-ctb-xcomp-controller-evidence.py \
  --source-dir /path/to/ctb9 \
  --glob '*.fid' \
  --output /tmp/ctb-xcomp-controller-audit.json
```

The JSON output contains only aggregate/source-integrity fields:

- `sourceFileCount`
- `treeCount`
- `controlCandidateCount`
- `subjectControllerCount`
- `objectControllerCount`
- `unresolvedCount`
- `projectableSubjectControllerCount`
- `projectableObjectControllerCount`
- `unindexedProCount`
- `missingMatrixHeadCount`
- `sourceDigest`
- `determinismDigest`

It does not emit sentence text, lexical rows, or controller identities.

## Interpretation gate for a full-source run

A later full CTB 9.0 measurement must report at least:

- how many selected `IP-OBJ` + `NP-SBJ(*PRO*)` candidates are indexed versus unindexed;
- subject/object/unresolved counts within the indexed subset;
- how many typed observations expose one projectable matrix `VV` head;
- source and determinism digests;
- whether identity-index usage is sufficiently stable to justify any lexical capability projection.

A low indexed-PRO coverage rate is not permission to backfill controller type from lexical verb lists, matrix object presence, or semantics. It is evidence that this source contract has limited coverage.

## What this slice does not do

This is a source-capability measurement probe only. It does not:

- add subject-control or object-control runtime capabilities;
- change active syntax profiles;
- make `clause.xcomp-subject-control` or `clause.xcomp-object-control` reachable in product;
- infer controller type from lexical meaning or hand-written verb lists;
- infer subject control from the absence of a matrix object;
- infer object control from a basic object plus embedded clause;
- change product probability, Measurement V2, or progress state.

A later slice may project controller-typed lexical identities only after a licensed full-source run is reviewed for indexed coverage, counts, unresolved cases, head extraction, identity ambiguity, and source fingerprint stability.
