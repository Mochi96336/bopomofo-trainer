import { createHash } from "node:crypto";
import type { CsvRecord } from "../catalog/csv.js";
import { numberedPinyinToTrainerReading } from "./pinyin-to-bopomofo.js";

export const READING_RESOLUTION_MODEL_VERSION = "catalog-reading-resolution-v1";

export type ReadingSourceKind =
  | "moe-concised"
  | "moe-revised"
  | "cedict"
  | "manual"
  | "reviewed-catalog";
export type ReadingConfidence = "authoritative" | "provisional" | "fallback" | "reviewed";

export interface ReadingResolutionRow {
  readonly text: string;
  readonly originalReading: string;
  readonly resolvedReading: string;
  readonly sourceKind: ReadingSourceKind;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly evidenceId: string;
  readonly sourceReading: string;
  readonly confidence: ReadingConfidence;
  readonly changed: boolean;
  readonly reasons: readonly string[];
}

export interface ReadingResolutionReport {
  readonly modelVersion: typeof READING_RESOLUTION_MODEL_VERSION;
  readonly candidateCount: number;
  readonly counts: Readonly<Partial<Record<ReadingSourceKind, number>>>;
  readonly changedTexts: readonly string[];
  readonly rows: readonly ReadingResolutionRow[];
  readonly determinismDigest: string;
}

export interface CatalogReadingResolutionResult {
  readonly records: readonly CsvRecord[];
  readonly report: ReadingResolutionReport;
}

export interface CatalogReadingResolutionInput {
  readonly catalogRecords: readonly CsvRecord[];
  readonly moeConcisedProjection: unknown;
  readonly moeRevisedProjection: unknown;
  readonly cedictProjection: unknown;
  readonly manualOverrides: unknown;
}

export class CatalogReadingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogReadingResolutionError";
  }
}

interface ResolutionEvidence {
  readonly resolvedReading: string;
  readonly sourceKind: ReadingSourceKind;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly evidenceId: string;
  readonly sourceReading: string;
  readonly confidence: ReadingConfidence;
  readonly reasons: readonly string[];
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CatalogReadingResolutionError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CatalogReadingResolutionError(`${label} must be a non-empty string`);
  }
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CatalogReadingResolutionError(`${label} must be a finite number`);
  }
  return value;
}

function arrayValue(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new CatalogReadingResolutionError(`${label} must be an array`);
  }
  return value;
}

function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

function normalizeReading(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .join(" ");
}

function splitProvenance(value: string): string[] {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

/**
 * A catalog text may now have more than one active row when it is a real
 * heteronym (multiple valid readings for the same hanzi) -- each row is a
 * distinct practice entry. When a text has exactly one active row, identity
 * stays text-only (as before): this preserves the ability for a row's own
 * `reading` cell to hold a stale provisional value that evidence corrects.
 * Only when a text has multiple active rows -- which can only happen for
 * rows whose own `reading` cell already holds its final, resolution-ready
 * value -- does identity widen to (text, reading) to tell the rows apart.
 */
function makeIdentity(
  byText: ReadonlyMap<string, readonly CsvRecord[]>,
): (text: string, reading: string) => string {
  return (text, reading) =>
    ((byText.get(text)?.length ?? 0) > 1 ? `${text}\0${reading}` : text);
}

interface ActiveCatalogRows {
  readonly byIdentity: ReadonlyMap<string, CsvRecord>;
  readonly byText: ReadonlyMap<string, readonly CsvRecord[]>;
  readonly identity: (text: string, reading: string) => string;
}

function activeCatalogRows(records: readonly CsvRecord[]): ActiveCatalogRows {
  const byText = new Map<string, CsvRecord[]>();
  for (const record of records) {
    if ((record.values.status ?? "") === "excluded") {
      continue;
    }
    const text = normalizeText(record.values.text ?? "");
    if (text.length === 0) {
      throw new CatalogReadingResolutionError(`catalog row ${record.rowNumber} is missing text`);
    }
    const forText = byText.get(text) ?? [];
    forText.push(record);
    byText.set(text, forText);
  }
  const identity = makeIdentity(byText);
  const byIdentity = new Map<string, CsvRecord>();
  for (const [text, rows] of byText) {
    for (const record of rows) {
      const reading = normalizeReading(record.values.reading ?? "");
      const id = identity(text, reading);
      if (byIdentity.has(id)) {
        throw new CatalogReadingResolutionError(`duplicate active catalog row: ${text} ${reading}`);
      }
      byIdentity.set(id, record);
    }
  }
  return { byIdentity, byText, identity };
}

function addEvidence(
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  identity: string,
  evidence: ResolutionEvidence,
): void {
  if (!activeIdentities.has(identity)) {
    throw new CatalogReadingResolutionError(`reading evidence targets unknown catalog row: ${identity}`);
  }
  const previous = resolved.get(identity);
  if (previous !== undefined) {
    throw new CatalogReadingResolutionError(
      `reading evidence overlap for ${identity}: ${previous.sourceKind} and ${evidence.sourceKind}`,
    );
  }
  resolved.set(identity, evidence);
}

function readSource(root: Record<string, unknown>, label: string): {
  readonly sourceId: string;
  readonly sourceVersion: string;
} {
  const source = objectValue(root.source, `${label}.source`);
  return {
    sourceId: stringValue(source.sourceId, `${label}.source.sourceId`),
    sourceVersion: stringValue(source.sourceVersion, `${label}.source.sourceVersion`),
  };
}

function applySingleReadingAuthority(
  text: string,
  rowsByText: ReadonlyMap<string, readonly CsvRecord[]>,
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  evidence: ResolutionEvidence,
): void {
  const rows = rowsByText.get(text) ?? [];
  if (rows.length === 0) {
    throw new CatalogReadingResolutionError(`reading evidence targets unknown catalog text: ${text}`);
  }
  if (rows.length > 1) {
    throw new CatalogReadingResolutionError(
      `${evidence.sourceKind} resolves a single reading but catalog text has multiple active rows: ${text}`,
    );
  }
  // A single-reading authority only ever applies to a text with exactly one
  // active row (checked above), so identity is always just the text itself.
  addEvidence(resolved, activeIdentities, text, evidence);
}

function applyMoeConcised(
  projection: unknown,
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  rowsByText: ReadonlyMap<string, readonly CsvRecord[]>,
): void {
  const root = objectValue(projection, "MOE Concised projection");
  if (root.adapterVersion !== "moe-concised-reading-adapter-v1") {
    throw new CatalogReadingResolutionError("unsupported MOE Concised projection adapter version");
  }
  const candidateSet = objectValue(root.candidateSet, "MOE Concised projection.candidateSet");
  const source = readSource(root, "MOE Concised projection");
  for (const [index, value] of arrayValue(root.rows, "MOE Concised projection.rows").entries()) {
    const row = objectValue(value, `MOE Concised row ${index}`);
    const text = normalizeText(stringValue(row.lookupText, `MOE Concised row ${index}.lookupText`));
    const reading = normalizeReading(
      stringValue(row.trainerReading, `MOE Concised row ${index}.trainerReading`),
    );
    const entryId = stringValue(row.sourceEntryId, `MOE Concised row ${index}.sourceEntryId`);
    applySingleReadingAuthority(text, rowsByText, resolved, activeIdentities, {
      resolvedReading: reading,
      sourceKind: "moe-concised",
      sourceId: source.sourceId,
      sourceVersion: source.sourceVersion,
      evidenceId: entryId,
      sourceReading: reading,
      confidence: "authoritative",
      reasons: ["MOE Concised exact headword has one accepted reading"],
    });
  }
  const entryCount = numberValue(
    candidateSet.entryCount,
    "MOE Concised candidate entry count",
  );
  const normalizedTextCount = candidateSet.normalizedTextCount === undefined
    ? entryCount
    : numberValue(
      candidateSet.normalizedTextCount,
      "MOE Concised normalized text count",
    );
  if (normalizedTextCount !== rowsByText.size) {
    throw new CatalogReadingResolutionError("MOE Concised projection text count mismatch");
  }
  // Legacy projections used entryCount for distinct written forms. Current
  // projections count exact catalog identities (including heteronyms). Both
  // remain lineage-valid when normalizedTextCount matches the written forms.
  if (entryCount !== rowsByText.size && entryCount !== activeIdentities.size) {
    throw new CatalogReadingResolutionError("MOE Concised projection candidate count mismatch");
  }
}

function applyMoeRevised(
  projection: unknown,
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  rowsByText: ReadonlyMap<string, readonly CsvRecord[]>,
): void {
  const root = objectValue(projection, "MOE Revised projection");
  if (root.adapterVersion !== "moe-revised-reading-fallback-adapter-v1") {
    throw new CatalogReadingResolutionError("unsupported MOE Revised projection adapter version");
  }
  const source = readSource(root, "MOE Revised projection");
  const fallbackBasis = objectValue(root.fallbackBasis, "MOE Revised projection.fallbackBasis");
  const fallbackTexts = new Set(
    arrayValue(fallbackBasis.fallbackCandidateTexts, "MOE Revised fallback candidates")
      .map((value, index) => normalizeText(stringValue(value, `MOE Revised fallback ${index}`))),
  );
  for (const [index, value] of arrayValue(root.rows, "MOE Revised projection.rows").entries()) {
    const row = objectValue(value, `MOE Revised row ${index}`);
    const text = normalizeText(stringValue(row.lookupText, `MOE Revised row ${index}.lookupText`));
    if (!fallbackTexts.has(text)) {
      throw new CatalogReadingResolutionError(`MOE Revised row is outside its fallback basis: ${text}`);
    }
    if (row.fallbackStatus !== "provisional") {
      throw new CatalogReadingResolutionError(`MOE Revised row is not provisional: ${text}`);
    }
    const reading = normalizeReading(
      stringValue(row.trainerReading, `MOE Revised row ${index}.trainerReading`),
    );
    const entryId = stringValue(row.sourceEntryId, `MOE Revised row ${index}.sourceEntryId`);
    applySingleReadingAuthority(text, rowsByText, resolved, activeIdentities, {
      resolvedReading: reading,
      sourceKind: "moe-revised",
      sourceId: source.sourceId,
      sourceVersion: source.sourceVersion,
      evidenceId: entryId,
      sourceReading: reading,
      confidence: "provisional",
      reasons: ["MOE Revised exact headword has one fallback reading"],
    });
  }
}

function applyCedict(
  projection: unknown,
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  rowsByText: ReadonlyMap<string, readonly CsvRecord[]>,
  resolvedTextsAfterMoe: ReadonlySet<string>,
  allTexts: ReadonlySet<string>,
): void {
  const root = objectValue(projection, "CC-CEDICT projection");
  if (root.adapterVersion !== "cedict-identity-hints-adapter-v1") {
    throw new CatalogReadingResolutionError("unsupported CC-CEDICT projection adapter version");
  }
  const source = readSource(root, "CC-CEDICT projection");
  const resolutionBasis = objectValue(root.resolutionBasis, "CC-CEDICT projection.resolutionBasis");
  const targetTexts = new Set(
    arrayValue(resolutionBasis.cedictTargetTexts, "CC-CEDICT target texts")
      .map((value, index) => normalizeText(stringValue(value, `CC-CEDICT target ${index}`))),
  );
  const unresolvedAfterMoe = new Set([...allTexts].filter((text) => !resolvedTextsAfterMoe.has(text)));
  if (!sameSet(targetTexts, unresolvedAfterMoe)) {
    throw new CatalogReadingResolutionError(
      `CC-CEDICT target set does not match MOE-unresolved catalog texts: expected ${sorted(unresolvedAfterMoe).join(", ")}`,
    );
  }

  const seenRows = new Set<string>();
  for (const [index, value] of arrayValue(root.rows, "CC-CEDICT projection.rows").entries()) {
    const row = objectValue(value, `CC-CEDICT row ${index}`);
    const text = normalizeText(stringValue(row.lookupText, `CC-CEDICT row ${index}.lookupText`));
    if (!targetTexts.has(text)) {
      throw new CatalogReadingResolutionError(`CC-CEDICT row is outside its target set: ${text}`);
    }
    if (seenRows.has(text)) {
      throw new CatalogReadingResolutionError(`duplicate CC-CEDICT projection row: ${text}`);
    }
    seenRows.add(text);
    const status = stringValue(row.status, `CC-CEDICT row ${index}.status`);
    const records = arrayValue(row.records, `CC-CEDICT row ${index}.records`);
    if (status === "ambiguous-records") {
      if (records.length < 2) {
        throw new CatalogReadingResolutionError(`ambiguous CC-CEDICT row has fewer than two records: ${text}`);
      }
      continue;
    }
    if (status !== "unique-record" || records.length !== 1) {
      throw new CatalogReadingResolutionError(`invalid CC-CEDICT row status or record count: ${text}`);
    }
    const record = objectValue(records[0], `CC-CEDICT row ${index}.records[0]`);
    const pinyin = stringValue(record.pinyin, `CC-CEDICT row ${index}.records[0].pinyin`);
    const sourceLine = numberValue(
      record.sourceLine,
      `CC-CEDICT row ${index}.records[0].sourceLine`,
    );
    const reading = numberedPinyinToTrainerReading(pinyin);
    applySingleReadingAuthority(text, rowsByText, resolved, activeIdentities, {
      resolvedReading: reading,
      sourceKind: "cedict",
      sourceId: source.sourceId,
      sourceVersion: source.sourceVersion,
      evidenceId: `line:${sourceLine}`,
      sourceReading: pinyin,
      confidence: "fallback",
      reasons: ["CC-CEDICT has one exact candidate record after both MOE sources were unresolved"],
    });
  }
}

function applyManualOverrides(
  overrides: unknown,
  resolved: Map<string, ResolutionEvidence>,
  activeIdentities: ReadonlySet<string>,
  allIdentities: ReadonlySet<string>,
  identity: (text: string, reading: string) => string,
): void {
  const root = objectValue(overrides, "manual reading overrides");
  if (root.version !== "manual-reading-overrides-v1") {
    throw new CatalogReadingResolutionError("unsupported manual reading override version");
  }
  const provenanceId = stringValue(root.provenanceId, "manual reading overrides.provenanceId");
  const sourceVersion = stringValue(root.sourceVersion, "manual reading overrides.sourceVersion");
  const rows = arrayValue(root.rows, "manual reading overrides.rows");
  const unresolved = new Set([...allIdentities].filter((id) => !resolved.has(id)));
  const overrideIdentities = new Set<string>();
  const parsedRows: Array<{
    readonly text: string;
    readonly reading: string;
    readonly reason: string;
  }> = [];

  for (const [index, value] of rows.entries()) {
    const row = objectValue(value, `manual override row ${index}`);
    const text = normalizeText(stringValue(row.text, `manual override row ${index}.text`));
    const reading = normalizeReading(stringValue(row.reading, `manual override row ${index}.reading`));
    const id = identity(text, reading);
    if (overrideIdentities.has(id)) {
      throw new CatalogReadingResolutionError(`duplicate manual reading override: ${text} ${reading}`);
    }
    overrideIdentities.add(id);
    parsedRows.push({
      text,
      reading,
      reason: stringValue(row.reason, `manual override row ${index}.reason`),
    });
  }

  if (!sameSet(overrideIdentities, unresolved)) {
    throw new CatalogReadingResolutionError(
      `manual overrides must exactly match externally unresolved rows: expected ${sorted(unresolved).join(", ")}`,
    );
  }
  for (const row of parsedRows) {
    addEvidence(resolved, activeIdentities, identity(row.text, row.reading), {
      resolvedReading: row.reading,
      sourceKind: "manual",
      sourceId: provenanceId,
      sourceVersion,
      evidenceId: `manual:${row.text}:${row.reading}`,
      sourceReading: row.reading,
      confidence: "reviewed",
      reasons: [row.reason],
    });
  }
}

function createReport(
  activeRows: ReadonlyMap<string, CsvRecord>,
  resolved: ReadonlyMap<string, ResolutionEvidence>,
): ReadingResolutionReport {
  const rows = [...activeRows.entries()].map(([identity, record]) => {
    const evidence = resolved.get(identity);
    if (evidence === undefined) {
      throw new CatalogReadingResolutionError(`catalog row remains unresolved: ${identity}`);
    }
    const text = normalizeText(record.values.text ?? "");
    const originalReading = normalizeReading(record.values.reading ?? "");
    return {
      text,
      originalReading,
      resolvedReading: evidence.resolvedReading,
      sourceKind: evidence.sourceKind,
      sourceId: evidence.sourceId,
      sourceVersion: evidence.sourceVersion,
      evidenceId: evidence.evidenceId,
      sourceReading: evidence.sourceReading,
      confidence: evidence.confidence,
      changed: originalReading !== evidence.resolvedReading,
      reasons: evidence.reasons,
    } satisfies ReadingResolutionRow;
  }).sort((left, right) => {
    if (left.text !== right.text) {
      return left.text < right.text ? -1 : 1;
    }
    return left.resolvedReading < right.resolvedReading
      ? -1
      : left.resolvedReading > right.resolvedReading
      ? 1
      : 0;
  });

  const counts: Partial<Record<ReadingSourceKind, number>> = {
    "moe-concised": 0,
    "moe-revised": 0,
    cedict: 0,
    manual: 0,
  };
  for (const row of rows) {
    counts[row.sourceKind] = (counts[row.sourceKind] ?? 0) + 1;
  }
  const changedTexts = rows.filter((row) => row.changed).map((row) => row.text);
  const digestPayload = {
    modelVersion: READING_RESOLUTION_MODEL_VERSION,
    candidateCount: rows.length,
    counts,
    rows,
  };
  return {
    modelVersion: READING_RESOLUTION_MODEL_VERSION,
    candidateCount: rows.length,
    counts,
    changedTexts,
    rows,
    determinismDigest: createHash("sha256")
      .update(JSON.stringify(digestPayload), "utf8")
      .digest("hex"),
  };
}

/**
 * Clean-replace catalogs carry their accepted readings in the reviewed rows.
 * Mixed or provisional batches return null and must replay external evidence.
 */
export function acceptReviewedCatalogReadings(
  catalogRecords: readonly CsvRecord[],
): CatalogReadingResolutionResult | null {
  const activeRecords = catalogRecords.filter(
    (record) => (record.values.status ?? "") !== "excluded",
  );
  if (activeRecords.length === 0
    || activeRecords.some((record) => (record.values.status ?? "") !== "reviewed")) {
    return null;
  }
  const active = activeCatalogRows(catalogRecords);
  const rows = [...active.byIdentity.entries()]
    .map(([identity, record]): ReadingResolutionRow => {
      const text = normalizeText(record.values.text ?? "");
      const reading = normalizeReading(record.values.reading ?? "");
      if (!reading) {
        throw new CatalogReadingResolutionError(
          `reviewed catalog row is missing a reading: ${identity}`,
        );
      }
      return {
        text,
        originalReading: reading,
        resolvedReading: reading,
        sourceKind: "reviewed-catalog",
        sourceId: "catalog:reviewed-source",
        sourceVersion: "current",
        evidenceId: `catalog-row:${record.rowNumber}`,
        sourceReading: reading,
        confidence: "reviewed",
        changed: false,
        reasons: ["active catalog row is explicitly reviewed"],
      };
    })
    .sort((left, right) =>
      left.text < right.text ? -1
      : left.text > right.text ? 1
      : left.resolvedReading < right.resolvedReading ? -1
      : left.resolvedReading > right.resolvedReading ? 1
      : 0
    );
  const counts = { "reviewed-catalog": rows.length } as const;
  const digestPayload = {
    modelVersion: READING_RESOLUTION_MODEL_VERSION,
    candidateCount: rows.length,
    counts,
    rows,
  };
  return {
    records: catalogRecords,
    report: {
      modelVersion: READING_RESOLUTION_MODEL_VERSION,
      candidateCount: rows.length,
      counts,
      changedTexts: [],
      rows,
      determinismDigest: createHash("sha256")
        .update(JSON.stringify(digestPayload), "utf8")
        .digest("hex"),
    },
  };
}

function fullyResolvedTexts(
  allTexts: ReadonlySet<string>,
  rowsByText: ReadonlyMap<string, readonly CsvRecord[]>,
  resolved: ReadonlyMap<string, ResolutionEvidence>,
  identity: (text: string, reading: string) => string,
): Set<string> {
  return new Set(
    [...allTexts].filter((text) =>
      (rowsByText.get(text) ?? []).every((row) =>
        resolved.has(identity(text, normalizeReading(row.values.reading ?? "")))
      )
    ),
  );
}

export function resolveCatalogReadings(
  input: CatalogReadingResolutionInput,
): CatalogReadingResolutionResult {
  const { byIdentity: activeRows, byText: rowsByText, identity } = activeCatalogRows(input.catalogRecords);
  const activeIdentities = new Set(activeRows.keys());
  const allTexts = new Set(rowsByText.keys());
  const resolved = new Map<string, ResolutionEvidence>();

  applyMoeConcised(input.moeConcisedProjection, resolved, activeIdentities, rowsByText);
  applyMoeRevised(input.moeRevisedProjection, resolved, activeIdentities, rowsByText);
  const resolvedTextsAfterMoe = fullyResolvedTexts(allTexts, rowsByText, resolved, identity);
  applyCedict(
    input.cedictProjection,
    resolved,
    activeIdentities,
    rowsByText,
    resolvedTextsAfterMoe,
    allTexts,
  );
  applyManualOverrides(input.manualOverrides, resolved, activeIdentities, activeIdentities, identity);

  if (resolved.size !== activeIdentities.size) {
    throw new CatalogReadingResolutionError(
      `resolved ${resolved.size} readings for ${activeIdentities.size} active catalog rows`,
    );
  }
  const report = createReport(activeRows, resolved);
  const records = input.catalogRecords.map((record) => {
    if ((record.values.status ?? "") === "excluded") {
      return record;
    }
    const text = normalizeText(record.values.text ?? "");
    const originalReading = normalizeReading(record.values.reading ?? "");
    const id = identity(text, originalReading);
    const evidence = resolved.get(id);
    if (evidence === undefined) {
      throw new CatalogReadingResolutionError(`catalog row is unresolved: ${text}`);
    }
    const provenanceIds = [...new Set([
      ...splitProvenance(record.values.provenance_ids ?? ""),
      evidence.sourceId,
    ])];
    return {
      rowNumber: record.rowNumber,
      values: {
        ...record.values,
        reading: evidence.resolvedReading,
        provenance_ids: provenanceIds.join(";"),
      },
    };
  });
  return { records, report };
}

export function synchronizeRecordReadings(
  records: readonly CsvRecord[],
  report: ReadingResolutionReport,
): readonly CsvRecord[] {
  const textOccurrences = new Map<string, number>();
  for (const row of report.rows) {
    textOccurrences.set(row.text, (textOccurrences.get(row.text) ?? 0) + 1);
  }
  const identity = (text: string, reading: string) =>
    (textOccurrences.get(text) ?? 0) > 1 ? `${text}\0${reading}` : text;

  const readings = new Map<string, string>();
  for (const row of report.rows) {
    readings.set(identity(row.text, row.originalReading), row.resolvedReading);
  }
  return records.map((record) => {
    const text = normalizeText(record.values.text ?? "");
    const originalReading = normalizeReading(record.values.reading ?? "");
    const reading = readings.get(identity(text, originalReading));
    if (reading === undefined) {
      throw new CatalogReadingResolutionError(
        `sidecar row ${record.rowNumber} references unresolved catalog row: ${text} ${originalReading}`,
      );
    }
    return {
      rowNumber: record.rowNumber,
      values: { ...record.values, reading },
    };
  });
}
