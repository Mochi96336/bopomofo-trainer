const INSPECTION_SHORTCUT_CODES = new Set(["F8", "F9", "F10"]);

export function isInspectionShortcutCode(code: string): boolean {
  return INSPECTION_SHORTCUT_CODES.has(code);
}

/**
 * Keeps development-only inspection keys from reaching the product listener in
 * production. Deliberately does not call preventDefault, so the browser or OS
 * remains free to handle the function key normally.
 */
export function bindProductionInspectionBoundary(
  target: Window,
  production: boolean,
): () => void {
  if (!production) return () => {};
  const listener = (event: KeyboardEvent): void => {
    if (!isInspectionShortcutCode(event.code)) return;
    event.stopPropagation();
  };
  target.addEventListener("keydown", listener, { capture: true });
  return () => target.removeEventListener("keydown", listener, { capture: true });
}

interface FileInputLike {
  readonly id: string;
  readonly type: string;
  value: string;
}

function fileInputLike(value: unknown): value is FileInputLike {
  return typeof value === "object"
    && value !== null
    && "id" in value
    && "type" in value
    && "value" in value
    && typeof value.id === "string"
    && typeof value.type === "string"
    && typeof value.value === "string";
}

/** Clears the picker after its target handler has captured the selected File. */
export function resetImportedBackupSelection(target: unknown): boolean {
  if (!fileInputLike(target) || target.id !== "import-backup" || target.type !== "file") {
    return false;
  }
  target.value = "";
  return true;
}

export function bindBackupFileInputReset(target: Document): () => void {
  const listener = (event: Event): void => {
    resetImportedBackupSelection(event.target);
  };
  target.addEventListener("change", listener);
  return () => target.removeEventListener("change", listener);
}
