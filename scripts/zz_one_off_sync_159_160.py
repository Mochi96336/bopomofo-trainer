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


# Measurement policy: #159 owns aggregate-5; #160 adds Strategy channels.
replace_once(
    "src/measurement-v2/aggregate.ts",
    'export const PREVIOUS_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-3" as const;\nexport const MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-4" as const;',
    'export const PREVIOUS_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-3" as const;\nexport const BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-4" as const;\nexport const MEASUREMENT_V2_POLICY_VERSION = "input-order-v2-aggregate-5" as const;',
)

# Keep #160 Strategy types, but inherit #159 tone-aware revisit meaning.
replace_once(
    "src/measurement-v2/types.ts",
    "/**\n * Reappearance of the same conventional hand assignment inside one word body.\n * Tone keys and cross-word/syllable predecessors are deliberately excluded;\n * tone completion is owned by ToneCommitObservation instead.\n */",
    "/**\n * Reappearance of the same conventional hand assignment inside one syllable.\n * Accepted body components and the final accepted tone can both complete a\n * revisit; predecessors never cross a syllable or entry boundary.\n */",
)

# Compose #160 trajectory derivation with #159 tone-aware same-hand recurrence.
path = "src/measurement-v2/derive-observations.ts"
text = read(path)
helper = '''  const recordSameHandRevisit = (trace: InteractionTraceV2): void => {
    if (activeRevisitSyllable !== trace.syllableOrdinal) {
      resetBodyRevisitState(previousByHand, dirtyByHand, oppositeEventsSince);
      activeRevisitSyllable = trace.syllableOrdinal;
    }
    const hand = explicitHand(trace.physicalCode);
    if (hand === null) {
      resetBodyRevisitState(previousByHand, dirtyByHand, oppositeEventsSince);
      return;
    }
    const previousSameHand = previousByHand[hand];
    if (previousSameHand !== null) {
      sameHandRevisits.push({
        traceSequence: trace.sequence,
        hand,
        boundary: "within-syllable",
        timingMs: Math.max(0, trace.timestampMs - previousSameHand.timestampMs),
        oppositeHandEventsBetween: oppositeEventsSince[hand],
        clean: !dirtyByHand[hand],
      });
    }
    previousByHand[hand] = trace;
    dirtyByHand[hand] = false;
    oppositeEventsSince[hand] = 0;
    oppositeEventsSince[otherHand(hand)] += 1;
  };

'''
if "const recordSameHandRevisit = (trace: InteractionTraceV2)" not in text:
    anchor = "  const bodyEvents = new Map<number, InteractionTraceV2[]>();\n  const dirtyCoordination = new Set<number>();\n\n"
    if text.count(anchor) != 1:
        raise SystemExit("derive-observations: helper insertion anchor drifted")
    text = text.replace(anchor, anchor + helper)

old_body = '''      // Same-hand revisit is a word-body metric. Tone keys and earlier words
      // must never become predecessors for this family.
      if (activeRevisitSyllable !== trace.syllableOrdinal) {
        resetBodyRevisitState(previousByHand, dirtyByHand, oppositeEventsSince);
        activeRevisitSyllable = trace.syllableOrdinal;
      }
      const bodyHand = explicitHand(trace.physicalCode);
      if (bodyHand === null) {
        resetBodyRevisitState(previousByHand, dirtyByHand, oppositeEventsSince);
      } else {
        const previousSameHand = previousByHand[bodyHand];
        if (previousSameHand !== null) {
          sameHandRevisits.push({
            traceSequence: trace.sequence,
            hand: bodyHand,
            boundary: "within-syllable",
            timingMs: Math.max(0, trace.timestampMs - previousSameHand.timestampMs),
            oppositeHandEventsBetween: oppositeEventsSince[bodyHand],
            clean: !dirtyByHand[bodyHand],
          });
        }
        previousByHand[bodyHand] = trace;
        dirtyByHand[bodyHand] = false;
        oppositeEventsSince[bodyHand] = 0;
        oppositeEventsSince[otherHand(bodyHand)] += 1;
      }
'''
new_body = '''      // Same-hand revisit follows accepted motor events inside one syllable.
      // A later tone key may therefore complete a revisit before the state resets.
      recordSameHandRevisit(trace);
'''
if old_body in text:
    if text.count(old_body) != 1:
        raise SystemExit("derive-observations: duplicate body-only revisit block")
    text = text.replace(old_body, new_body)
elif new_body not in text:
    raise SystemExit("derive-observations: accepted-component revisit block drifted")

call = "      recordSameHandRevisit(trace);\n"
call_count = text.count(call)
if call_count == 1:
    anchor = "      bodyEvents.delete(trace.syllableOrdinal);\n"
    if text.count(anchor) != 1:
        raise SystemExit("derive-observations: tone reset anchor drifted")
    text = text.replace(anchor, call + anchor)
elif call_count != 2:
    raise SystemExit(f"derive-observations: expected 1 or 2 revisit calls, got {call_count}")
write(path, text)

# Aggregate-4 is a real #160 draft predecessor: preserve valid Strategy channels
# while still resetting its body-only revisit family on migration.
path = "src/measurement-v2/serialize.ts"
text = read(path)
if "  BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION,\n" not in text:
    anchor = "import {\n"
    if anchor not in text:
        raise SystemExit("serialize: import anchor missing")
    text = text.replace(anchor, anchor + "  BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION,\n", 1)
old_versions = '''    || (value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== PREVIOUS_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== HANDSHAPE_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== LEGACY_MEASUREMENT_V2_POLICY_VERSION)'''
new_versions = '''    || (value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== PREVIOUS_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== HANDSHAPE_MEASUREMENT_V2_POLICY_VERSION
      && value.policyVersion !== LEGACY_MEASUREMENT_V2_POLICY_VERSION)'''
if old_versions in text:
    text = text.replace(old_versions, new_versions)
elif new_versions not in text:
    raise SystemExit("serialize: supported-version boundary drifted")
old_strategy = "  const currentStrategyEvidence = value.policyVersion === MEASUREMENT_V2_POLICY_VERSION;\n"
new_strategy = '''  const currentStrategyEvidence = value.policyVersion === MEASUREMENT_V2_POLICY_VERSION
    || value.policyVersion === BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION;
'''
if old_strategy in text:
    text = text.replace(old_strategy, new_strategy)
elif new_strategy not in text:
    raise SystemExit("serialize: Strategy evidence boundary drifted")
if "const legacySameHandRevisit = value.policyVersion !== MEASUREMENT_V2_POLICY_VERSION;" not in text:
    raise SystemExit("serialize: tone-aware revisit reset boundary missing")
write(path, text)

# #159 presentation owns genuine return-only revisit semantics; #160 owns Strategy.
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
    raise SystemExit("analysis-v2-model: return-only filter drifted")
write(path, text)

path = "src/app/analysis-v2-panel.ts"
text = read(path)
old_fn = '''function revisitMovementDiagram(): string {
  return `<div class="analysis-v2-movement-diagram" aria-label="同側再次出現；中間可能連續，也可能穿插另一側">
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>↗</i><span>同側</span><b>／</b><span>同側</span><i>↘</i><span>另一側</span><i>↗</i><span>同側</span></div>
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
elif new_fn not in text:
    text = text.replace(
        'aria-label="同側再次出現；中間可能連續，也可能穿插另一側"',
        'aria-label="同一音節內離開一側後回到原側；最後的聲調鍵也可以成為回返終點"',
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
    raise SystemExit("panel: stale same-side presentation copy remains")
write(path, text)

# Align direct assertions with current presentation and the recent two-part copy cleanup.
for path in [
    "tests/app/analysis-v2-panel.test.ts",
    "tests/browser/analysis-v2-feedback.browser.ts",
]:
    text = read(path).replace("同側再出手", "同側回返")
    write(path, text)

path = "tests/app/analysis-v2-panel.test.ts"
text = read(path)
old = '    expect(host.querySelector(".analysis-v2-method")?.textContent).toContain("位置偏移");\n'
new = '    expect(host.querySelector(".analysis-v2-method")?.textContent).toContain("位置投影");\n'
if old in text:
    if text.count(old) != 1:
        raise SystemExit("panel test: duplicate stale two-part wording assertion")
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit("panel test: two-part methodology assertion drifted")
write(path, text)

# Lock the critical aggregate-4 → aggregate-5 Strategy migration contract.
path = "tests/measurement-v2/legacy-strategy-evidence.test.ts"
text = read(path)
if "BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION" not in text:
    text = text.replace(
        "import {\n",
        "import {\n  BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION,\n",
        1,
    )
test_block = '''
  it("preserves valid Strategy channels from aggregate-4 while resetting body-only revisit evidence", () => {
    const legacy = withFutureStrategyEvidence(BODY_ONLY_REVISIT_MEASUREMENT_V2_POLICY_VERSION);
    const motor = legacy.motor as Record<string, unknown>;
    motor.sameHandRevisits = {
      '["same-hand-revisit","left",true]': {
        scope: { hand: "left", oppositeHandIntervened: true },
        observations: 5,
        timingSamples: 5,
        currentTimeToTypeMs: 180,
        bestTimeToTypeMs: 150,
      },
    };

    const migrated = parseMeasurementSummaryV2(legacy, "guided", "zhuyin-standard", TOKENS);

    expect(Object.keys(migrated?.strategy.inputOrderPermutations ?? {})).toHaveLength(1);
    expect(migrated?.strategy.recentInputOrderTrajectories).toHaveLength(1);
    expect(migrated?.motor.sameHandRevisits).toEqual({});
  });
'''
if "preserves valid Strategy channels from aggregate-4 while resetting body-only revisit evidence" not in text:
    anchor = '\n  it("still preserves those channels under the current policy", () => {'
    if text.count(anchor) != 1:
        raise SystemExit("legacy Strategy test insertion anchor drifted")
    text = text.replace(anchor, test_block + anchor)
write(path, text)
