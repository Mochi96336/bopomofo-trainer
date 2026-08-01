import type { ProductBackup } from "./backup.js";

/**
 * The import sequence, separated from the state it replaces.
 *
 * Importing a backup is four decisions -- read, parse, ask, apply -- followed by
 * a long stretch of assignment. Both halves lived in one function in `main.ts`,
 * where the assignments reach a dozen module-level bindings, so nothing about
 * the order could be called from a test. The decisions are the half that can be
 * wrong: a declined import has to leave every one of those bindings alone, and a
 * file that cannot be opened must not be mistaken for one that parses to
 * nothing.
 *
 * Effects arrive as ports, so the order is assertable without a file picker, a
 * DOM, or a confirmation the test would have to answer.
 */

/**
 * Why an import produced nothing.
 *
 * Both currently reach the learner as the same sentence -- neither is worth
 * explaining differently to someone holding a file that will not open -- but
 * they are separate failures and stay separable here.
 */
export type BackupImportFailure = "file-read-failed" | "backup-invalid";

export type BackupImportOutcome =
  /** The picker closed with nothing chosen, so no import was attempted. */
  | { readonly kind: "no-file" }
  | { readonly kind: "unreadable"; readonly reason: BackupImportFailure }
  /** Declined at the confirmation. The parsed backup is deliberately not
   * carried out of here: a cancelled import has nothing for a caller to apply. */
  | { readonly kind: "cancelled" }
  | { readonly kind: "applied"; readonly backup: ProductBackup };

export interface BackupImportPorts {
  /** The chosen file's text, or `null` when nothing was chosen. May reject. */
  readSelectedFile(): Promise<string | null>;
  parse(source: string): ProductBackup | null;
  /**
   * Resolves false when the learner declines to replace what they have. Receives
   * the parsed backup, because a confirmation that cannot describe what is
   * arriving can only repeat the question.
   */
  confirmReplacement(backup: ProductBackup): Promise<boolean>;
}

export async function runBackupImport(
  ports: BackupImportPorts,
): Promise<BackupImportOutcome> {
  let source: string | null;
  try {
    source = await ports.readSelectedFile();
  } catch {
    // Reading fails on its own: the file may have moved or become unreadable
    // between the picker and here. That has to reach the panel the same way an
    // unparseable backup does, because the alternative is a rejected promise
    // nobody handles and a panel that silently says nothing happened.
    return { kind: "unreadable", reason: "file-read-failed" };
  }
  if (source === null) return { kind: "no-file" };

  const backup = ports.parse(source);
  if (backup === null) return { kind: "unreadable", reason: "backup-invalid" };

  // Asked only once the replacement is known to be possible. Confirming an
  // import that was going to fail anyway puts the learner's answer somewhere it
  // cannot be honoured.
  if (!await ports.confirmReplacement(backup)) return { kind: "cancelled" };
  return { kind: "applied", backup };
}
