from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old in text:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"{path}: expected one old fragment, found {count}")
        write(path, text.replace(old, new))
        return
    if new not in text:
        raise SystemExit(f"{path}: neither old nor reconciled fragment found")


# Schema 8 composes two independent evolutions:
# schema 7 = tone-aware revisit; schema 8 = exact-token timing history.
path = "src/progress-history/types.ts"
text = read(path)
start = text.index("// Schema ")
end = text.index("export const PROGRESS_HISTORY_SCHEMA_VERSION", start)
comment = '''// Schema 8 adds bounded history for exact accepted-token transitions on top of
// schema 7's tone-aware same-hand revisit semantics. Schema 7 therefore keeps
// its valid revisit history while exact transition history starts empty. Schema
// 6 used body-only revisit semantics, so its revisit series is validated then
// discarded and exact transition history also starts empty. Schema 5 and older
// retain their existing migration behavior.
'''
text = text[:start] + comment + text[end:]
text = text.replace(
    "export const PROGRESS_HISTORY_SCHEMA_VERSION = 7 as const;",
    "export const PROGRESS_HISTORY_SCHEMA_VERSION = 8 as const;",
)
if "export const PROGRESS_HISTORY_SCHEMA_VERSION = 8 as const;" not in text:
    raise SystemExit("progress types: schema 8 version missing")
if "ImmediateTokenAggregateScope" not in text or "readonly immediateTokens:" not in text:
    raise SystemExit("progress types: exact-token history family lost during merge")
write(path, text)

# Compose the parser truth table explicitly.
path = "src/progress-history/serialize.ts"
text = read(path)
text = text.replace(
    "const LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_6 = 6;",
    "const BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION = 6;\nconst TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION = 7;",
)
# If parent conflict resolution already introduced the body-only name, add 7 next to it.
if "const TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION = 7;" not in text:
    marker = "const BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION = 6;\n"
    if marker not in text:
        raise SystemExit("progress serialize: schema-6 constant missing")
    text = text.replace(marker, marker + "const TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION = 7;\n", 1)

old_supported = '''    schemaVersion !== PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_6
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
new_supported = '''    schemaVersion !== PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
if old_supported in text:
    text = text.replace(old_supported, new_supported)
elif new_supported not in text:
    # Parent-style serializer may already name schema 6 differently.
    old_parent = '''    schemaVersion !== PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
    && schemaVersion !== LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
    if old_parent in text:
        text = text.replace(old_parent, new_supported)
    elif new_supported not in text:
        raise SystemExit("progress serialize: supported schema list drifted")

old_coord = '''    const coordinationSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_6
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
new_coord = '''    const coordinationSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
if old_coord in text:
    text = text.replace(old_coord, new_coord)
elif new_coord not in text:
    old_parent = '''    const coordinationSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === BODY_ONLY_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_5'''
    if old_parent in text:
        text = text.replace(old_parent, new_coord)
    elif new_coord not in text:
        raise SystemExit("progress serialize: coordination schema truth table drifted")

# Exact-token history exists only in schema 8.
old_immediate = '''    const immediateTokenSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      ? "current"
      : "legacy-missing";'''
if old_immediate not in text:
    raise SystemExit("progress serialize: exact-token schema gate missing")

# Revisit history is current in schemas 8 and 7 only; schema 6 remains body-only.
old_same = '''    const sameHandSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_6
      ? "current"
      : "legacy";'''
new_same = '''    const sameHandSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      || schemaVersion === TONE_AWARE_REVISIT_PROGRESS_HISTORY_SCHEMA_VERSION
      ? "current"
      : "legacy";'''
if old_same in text:
    text = text.replace(old_same, new_same)
elif new_same not in text:
    old_parent = '''    const sameHandSchema = schemaVersion === PROGRESS_HISTORY_SCHEMA_VERSION
      ? "current"
      : "legacy";'''
    if old_parent in text:
        text = text.replace(old_parent, new_same)
    elif new_same not in text:
        raise SystemExit("progress serialize: revisit schema truth table drifted")

if "LEGACY_PROGRESS_HISTORY_SCHEMA_VERSION_6" in text:
    raise SystemExit("progress serialize: stale schema-6 alias remains")
if "immediateTokenSchema" not in text or "immediateTokens" not in text:
    raise SystemExit("progress serialize: exact-token parser lost during merge")
write(path, text)

# Restore current parent presentation semantics while keeping #161 exact history joins.
path = "src/app/analysis-v2-model.ts"
text = read(path)
old = '''  const sameHandRevisits = joinMotorFamily(
    measurements.motor.sameHandRevisits,
    history?.motor.sameHandRevisits,
  );
'''
new = '''  // Zero-opposite-hand revisits duplicate immediateHands (L→L / R→R).
  // Keep them persisted, but show only genuine leave-and-return patterns here.
  const sameHandRevisits = joinMotorFamily(
    measurements.motor.sameHandRevisits,
    history?.motor.sameHandRevisits,
  ).filter((cell) => cell.scope.oppositeHandIntervened);
'''
if old in text:
    text = text.replace(old, new)
elif ".filter((cell) => cell.scope.oppositeHandIntervened);" not in text:
    raise SystemExit("analysis model: return-only filter missing")
if "history?.motor.immediateTokens" not in text:
    raise SystemExit("analysis model: exact transition history join lost")
write(path, text)

path = "src/app/analysis-v2-panel.ts"
text = read(path)
old_fn = '''function revisitMovementDiagram(): string {
  return `<div class="analysis-v2-movement-diagram" aria-label="同側再次出現；中間可能連續，也可能穿插另一側">
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>同側</span></div>
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>另一側</span><i>→</i><span>同側</span></div>
  </div>`;
}
'''
new_fn = '''function revisitMovementDiagram(): string {
  return `<div class="analysis-v2-movement-diagram" aria-label="同一音節內離開一側後回到原側；最後的聲調鍵也可以成為回返終點">
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>另一側</span><i>→</i><span>同側</span></div>
  </div>`;
}
'''
if old_fn in text:
    text = text.replace(old_fn, new_fn)
else:
    text = text.replace(
        'aria-label="同側再次出現；中間可能連續，也可能穿插另一側"',
        'aria-label="同一音節內離開一側後回到原側；最後的聲調鍵也可以成為回返終點"',
    )
    text = text.replace(
        '    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>同側</span></div>\n',
        '',
    )
old_label = '''function revisitLabel(cell: AnalysisV2MotorCell<SameHandRevisitAggregateScope>): string {
  const hand = cell.scope.hand === "left" ? "左" : "右";
  if (!cell.scope.oppositeHandIntervened) return `${hand} · 連續`;
  return `${hand} · 隔${cell.scope.hand === "left" ? "右" : "左"}側`;
}
'''
new_label = '''function revisitLabel(cell: AnalysisV2MotorCell<SameHandRevisitAggregateScope>): string {
  const hand = cell.scope.hand === "left" ? "左" : "右";
  return `${hand} · 隔${cell.scope.hand === "left" ? "右" : "左"}側`;
}
'''
if old_label in text:
    text = text.replace(old_label, new_label)
elif new_label not in text:
    raise SystemExit("panel: revisit label drifted")
text = text.replace(
    'const observedRevisits = model.coordination.sameHandRevisits.filter((cell) => cell.observations > 0);',
    'const observedRevisits = model.coordination.sameHandRevisits.filter(\n    (cell) => cell.observations > 0 && cell.scope.oppositeHandIntervened,\n  );',
)
text = text.replace("尚無字內同側再出手資料", "尚無同音節同側回返資料")
text = text.replace('"同側再出手",', '"同側回返",')
text = text.replace(
    '"只比較同一個字內的注音成分；聲調與跨字事件不列入。可比較資料依目前代表時間由慢到快排列。",',
    '"比較同一音節內離開一側後回到原側的時間；連續同手已由手別轉換的左→左／右→右呈現。最後的聲調鍵可以成為回返終點，不跨音節。可比較資料依目前代表時間由慢到快排列。",',
)
text = text.replace(
    "同側再出手只看同一字內的注音成分，不含聲調或跨字事件。",
    "同側回返只看同一音節內離開一側後再次回到該側的已接受手部事件，包含最後聲調但不跨音節或跨字；連續同手留在手別轉換，避免重複呈現同一筆相鄰時間。",
)
if '"同側再出手",' in text or "尚無字內同側再出手資料" in text:
    raise SystemExit("panel: stale same-side presentation remains")
if "exactTransitionHistoryLabel" not in text:
    raise SystemExit("panel: exact transition history readout lost")
write(path, text)

# Align direct presentation assertions to inherited return-only semantics.
for path in [
    "tests/app/analysis-v2-panel.test.ts",
    "tests/browser/analysis-v2-feedback.browser.ts",
]:
    p = Path(path)
    if not p.exists():
        continue
    text = read(path).replace("同側再出手", "同側回返")
    write(path, text)

# Rewrite exact-history migration coverage around the new 6/7/8 truth table.
path = "tests/progress-history/serialize.test.ts"
text = read(path)
old_test = '''  it("migrates schema 6 without inventing exact transition history", () => {
    const source = mutate((draft) => {
      draft.schemaVersion = 6;
      const motor = draft.motor as Record<string, unknown>;
      delete motor.immediateTokens;
      motor.coordination = {
        '["coordination","initial-final"]': motorHistory({ bodyShape: "initial-final" }, 130),
      };
      motor.immediateHands = {
        '["immediate-hand","left","right"]': motorHistory({ fromHand: "left", toHand: "right" }, 110),
      };
      motor.sameHandRevisits = {
        '["same-hand-revisit","left",false]': motorHistory({
          hand: "left",
          oppositeHandIntervened: false,
        }, 150),
      };
      motor.toneCommits = {
        '["tone-commit","tone:2"]': motorHistory({ toneToken: "tone:2" }, 170),
      };
    });
    const migrated = parse(source);
    expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
    expect(migrated?.motor.immediateTokens).toEqual({});
    expect(Object.keys(migrated?.motor.coordination ?? {})).toEqual([
      '["coordination","initial-final"]',
    ]);
    expect(Object.keys(migrated?.motor.immediateHands ?? {})).toEqual([
      '["immediate-hand","left","right"]',
    ]);
    expect(Object.keys(migrated?.motor.sameHandRevisits ?? {})).toEqual([
      '["same-hand-revisit","left",false]',
    ]);
    expect(Object.keys(migrated?.motor.toneCommits ?? {})).toEqual([
      '["tone-commit","tone:2"]',
    ]);
  });
'''
new_test = '''  it("migrates schema 6 by dropping body-only revisit and starting exact history empty", () => {
    const source = mutate((draft) => {
      draft.schemaVersion = 6;
      const motor = draft.motor as Record<string, unknown>;
      delete motor.immediateTokens;
      motor.coordination = {
        '["coordination","initial-final"]': motorHistory({ bodyShape: "initial-final" }, 130),
      };
      motor.immediateHands = {
        '["immediate-hand","left","right"]': motorHistory({ fromHand: "left", toHand: "right" }, 110),
      };
      motor.sameHandRevisits = {
        '["same-hand-revisit","left",true]': motorHistory({
          hand: "left",
          oppositeHandIntervened: true,
        }, 150),
      };
      motor.toneCommits = {
        '["tone-commit","tone:2"]': motorHistory({ toneToken: "tone:2" }, 170),
      };
    });
    const migrated = parse(source);
    expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
    expect(migrated?.motor.immediateTokens).toEqual({});
    expect(Object.keys(migrated?.motor.coordination ?? {})).toEqual([
      '["coordination","initial-final"]',
    ]);
    expect(Object.keys(migrated?.motor.immediateHands ?? {})).toEqual([
      '["immediate-hand","left","right"]',
    ]);
    expect(migrated?.motor.sameHandRevisits).toEqual({});
    expect(Object.keys(migrated?.motor.toneCommits ?? {})).toEqual([
      '["tone-commit","tone:2"]',
    ]);
  });

  it("migrates schema 7 by preserving tone-aware revisit and starting exact history empty", () => {
    const source = mutate((draft) => {
      draft.schemaVersion = 7;
      const motor = draft.motor as Record<string, unknown>;
      delete motor.immediateTokens;
      motor.sameHandRevisits = {
        '["same-hand-revisit","left",true]': motorHistory({
          hand: "left",
          oppositeHandIntervened: true,
        }, 150),
      };
    });
    const migrated = parse(source);
    expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
    expect(migrated?.motor.immediateTokens).toEqual({});
    expect(Object.keys(migrated?.motor.sameHandRevisits ?? {})).toEqual([
      '["same-hand-revisit","left",true]',
    ]);
  });
'''
if old_test in text:
    text = text.replace(old_test, new_test)
elif "migrates schema 7 by preserving tone-aware revisit" not in text:
    raise SystemExit("serialize test: schema-6 exact-history migration block drifted")
write(path, text)

# Keep docs honest about the composed schema generation.
path = "docs/diagnostic-progress-history.md"
if Path(path).exists():
    text = read(path)
    text = text.replace("schema 7 adds", "schema 8 adds")
    text = text.replace("Schema 7 adds", "Schema 8 adds")
    text = text.replace("schema-7", "schema-8")
    text = text.replace("Schema 6 remains readable", "Schema 7 preserves tone-aware revisit history; schema 6 remains readable")
    write(path, text)
