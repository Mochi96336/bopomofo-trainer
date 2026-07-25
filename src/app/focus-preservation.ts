const SEMANTIC_DATA_KEYS = ["action", "tab", "token", "id", "value", "rarityTier"] as const;

export interface FocusIdentitySource {
  readonly id: string;
  readonly dataset: Readonly<Record<string, string | undefined>>;
}

export interface FocusIdentity {
  readonly id: string | null;
  readonly data: Readonly<Record<string, string>>;
}

export function focusIdentityFor(source: FocusIdentitySource): FocusIdentity | null {
  const data: Record<string, string> = {};
  for (const key of SEMANTIC_DATA_KEYS) {
    const value = source.dataset[key];
    if (value !== undefined) data[key] = value;
  }
  const id = source.id === "" ? null : source.id;
  return id === null && Object.keys(data).length === 0 ? null : { id, data };
}

export function focusIdentityMatches(
  source: FocusIdentitySource,
  identity: FocusIdentity,
): boolean {
  if (identity.id !== null && source.id !== identity.id) return false;
  return Object.entries(identity.data).every(([key, value]) => source.dataset[key] === value);
}

export function captureFocusIdentity(root: HTMLElement): FocusIdentity | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement || active instanceof SVGElement) || !root.contains(active)) {
    return null;
  }
  return focusIdentityFor(active);
}

export function restoreFocusIdentity(
  root: HTMLElement,
  identity: FocusIdentity | null,
  fallbackSelectors: readonly string[] = [],
): boolean {
  if (identity !== null) {
    const candidates = root.querySelectorAll<HTMLElement | SVGElement>(
      "button, input, select, textarea, summary, a[href], [tabindex], [data-action]",
    );
    for (const candidate of candidates) {
      if (!focusIdentityMatches(candidate, identity)) continue;
      if (candidate instanceof HTMLButtonElement && candidate.disabled) break;
      candidate.focus({ preventScroll: true });
      return true;
    }
  }
  for (const selector of fallbackSelectors) {
    const fallback = root.querySelector<HTMLElement>(selector);
    if (fallback === null || ("disabled" in fallback && fallback.disabled === true)) continue;
    fallback.focus({ preventScroll: true });
    return true;
  }
  return false;
}
