/**
 * The app renders markup by building strings, so every value that reaches the
 * page through one of those templates has to be escaped at the point it is
 * interpolated. This lived as three byte-identical private copies before it was
 * shared; a single definition is what keeps them from drifting apart.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
