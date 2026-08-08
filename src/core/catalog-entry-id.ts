export function catalogEntryId(text: string, reading: string): string {
  return `word:${text}:${reading.replace(/\s+/gu, "-")}`;
}
