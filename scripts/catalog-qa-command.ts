import { readFile, writeFile } from "node:fs/promises";
import { format } from "node:util";
import { parseCsv } from "../src/catalog/csv.js";
import {
  guardStratumOutput,
  metadataIntegrityDigest,
  verdictProgress,
  type VerdictColumn,
} from "./catalog-qa-command-core.js";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function repositoryFile(path: string): URL {
  return new URL(`../${path}`, import.meta.url);
}

async function readMetadata(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(repositoryFile(path), "utf8")) as Record<string, unknown>;
  } catch (error) {
    return fail(
      `cannot read the sample metadata at ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function sealMetadata(path: string): Promise<void> {
  const metadata = await readMetadata(path);
  const sealed = {
    ...metadata,
    integrityDigest: metadataIntegrityDigest(metadata),
  };
  await writeFile(repositoryFile(path), `${JSON.stringify(sealed, null, 2)}\n`, "utf8");
  console.log(`sealed the complete sample metadata (${path})`);
}

function verifyMetadata(path: string, metadata: Readonly<Record<string, unknown>>): void {
  const recorded = metadata["integrityDigest"];
  const actual = metadataIntegrityDigest(metadata);
  if (recorded !== actual) {
    fail(
      `${path} does not match its complete metadata digest.`
      + `\n  expected ${typeof recorded === "string" ? recorded : "(none)"}`
      + `\n  actual   ${actual}`
      + "\nCatalog counts, sampled counts, strata or draw time may have changed."
      + " Refusing to score.",
    );
  }
}

const argv = process.argv.slice(2);
const scoreMode = argv.includes("--score");

if (!scoreMode) {
  await import("./sample-catalog-qa.js");
  const out = flagValue(argv, "out") ?? "data/qa/catalog-sample.csv";
  await sealMetadata(out.replace(/\.csv$/u, ".meta.json"));
} else {
  const input = flagValue(argv, "score");
  if (input === undefined) {
    fail("--score needs the path of a filled review sheet, e.g. --score data/qa/catalog-sample.csv");
  }
  const metaPath = flagValue(argv, "meta") ?? input.replace(/\.csv$/u, ".meta.json");
  const metadata = await readMetadata(metaPath);
  verifyMetadata(metaPath, metadata);

  const sheet = await readFile(repositoryFile(input), "utf8");
  const records = parseCsv(sheet.replace(/^﻿/u, "")).records.map((record) => record.values);
  const columns: readonly VerdictColumn[] = ["reading_verdict", "role_verdict"];
  const progress = Object.fromEntries(
    columns.map((column) => [column, verdictProgress(records, column)]),
  ) as Record<VerdictColumn, ReturnType<typeof verdictProgress>>;

  const captured: string[] = [];
  const originalLog = console.log;
  console.log = (...args: Parameters<typeof console.log>): void => {
    captured.push(format(...args));
  };
  try {
    await import("./sample-catalog-qa.js");
  } finally {
    console.log = originalLog;
  }

  originalLog(guardStratumOutput(captured.join("\n"), progress));
}
