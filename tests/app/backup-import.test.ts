import { describe, expect, it } from "vitest";
import { PRODUCT_BACKUP_VERSION, type ProductBackup } from "../../src/app/backup.js";
import {
  runBackupImport,
  type BackupImportPorts,
} from "../../src/app/backup-import.js";
import { DEFAULT_SELECTION_TUNING } from "../../src/app/selection-tuning.js";
import { pilotHistoryFromProgress } from "../../src/product/pilot-history.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";
import { PRODUCT_CATALOGS } from "../product/fixtures.js";

const environment = createProductEnvironment(PRODUCT_CATALOGS);
const progress = createFreshProgressForEnvironment(
  environment,
  "imported",
  "guided",
  "standard",
);
const backup: ProductBackup = {
  backupVersion: PRODUCT_BACKUP_VERSION,
  exportedAt: "2026-01-01T00:00:00.000Z",
  progress,
  pilotHistory: pilotHistoryFromProgress(progress),
  progressHistory: createEmptyProgressHistory("guided", "standard"),
  selectionTuning: DEFAULT_SELECTION_TUNING,
};

interface RecordedPorts extends BackupImportPorts {
  readonly calls: readonly string[];
  readonly parsed: readonly string[];
  readonly described: readonly ProductBackup[];
}

function ports(overrides: Partial<BackupImportPorts> = {}): RecordedPorts {
  const calls: string[] = [];
  const parsed: string[] = [];
  const described: ProductBackup[] = [];
  return {
    readSelectedFile() {
      calls.push("read");
      return overrides.readSelectedFile?.() ?? Promise.resolve("{}");
    },
    parse(source) {
      calls.push("parse");
      parsed.push(source);
      return overrides.parse === undefined ? backup : overrides.parse(source);
    },
    confirmReplacement(candidate) {
      calls.push("confirm");
      described.push(candidate);
      return overrides.confirmReplacement?.(candidate) ?? Promise.resolve(true);
    },
    calls,
    parsed,
    described,
  };
}

describe("backup import sequence", () => {
  it("applies the parsed backup once the replacement is confirmed", async () => {
    const port = ports();
    const outcome = await runBackupImport(port);

    expect(outcome).toEqual({ kind: "applied", backup });
    expect(port.calls).toEqual(["read", "parse", "confirm"]);
  });

  // The whole point of asking: declining has to leave the learner's progress,
  // history, trend and tuning exactly as they were. The outcome carries no
  // backup, so there is nothing a caller could apply by mistake.
  it("carries nothing out when the replacement is declined", async () => {
    const port = ports({ confirmReplacement: () => Promise.resolve(false) });
    const outcome = await runBackupImport(port);

    expect(outcome).toEqual({ kind: "cancelled" });
    expect(outcome).not.toHaveProperty("backup");
  });

  it("separates a file that cannot be read from one that cannot be parsed", async () => {
    const unreadable = await runBackupImport(ports({
      readSelectedFile: () => Promise.reject(new Error("gone")),
    }));
    const invalid = await runBackupImport(ports({ parse: () => null }));

    expect(unreadable).toEqual({ kind: "unreadable", reason: "file-read-failed" });
    expect(invalid).toEqual({ kind: "unreadable", reason: "backup-invalid" });
  });

  it("does not ask about replacing anything when there is nothing to apply", async () => {
    const unreadable = ports({
      readSelectedFile: () => Promise.reject(new Error("gone")),
    });
    const invalid = ports({ parse: () => null });
    await runBackupImport(unreadable);
    await runBackupImport(invalid);

    expect(unreadable.calls).toEqual(["read"]);
    expect(invalid.calls).toEqual(["read", "parse"]);
  });

  it("attempts nothing when the picker closed without a file", async () => {
    const port = ports({ readSelectedFile: () => Promise.resolve(null) });
    const outcome = await runBackupImport(port);

    expect(outcome).toEqual({ kind: "no-file" });
    expect(port.calls).toEqual(["read"]);
  });

  // An empty file is a file. Only `null` means the picker closed with nothing,
  // and the two must not collapse into one falsy check: an empty file is an
  // invalid backup and has to say so.
  it("parses an empty file rather than treating it as no file", async () => {
    const port = ports({ readSelectedFile: () => Promise.resolve(""), parse: () => null });
    const outcome = await runBackupImport(port);

    expect(outcome).toEqual({ kind: "unreadable", reason: "backup-invalid" });
    expect(port.parsed).toEqual([""]);
  });

  // The confirmation shows what is arriving beside what is here, so it has to
  // be handed the parsed generation rather than only the question.
  it("hands the parsed backup to the confirmation", async () => {
    const port = ports();
    await runBackupImport(port);

    expect(port.described).toEqual([backup]);
  });

  it("reads the file once and parses exactly what it read", async () => {
    const port = ports({ readSelectedFile: () => Promise.resolve("{\"backupVersion\":2}") });
    await runBackupImport(port);

    expect(port.calls.filter((call) => call === "read")).toHaveLength(1);
    expect(port.parsed).toEqual(["{\"backupVersion\":2}"]);
  });
});
