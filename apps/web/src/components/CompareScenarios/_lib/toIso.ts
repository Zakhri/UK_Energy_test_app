export function toIso(datetimeLocal: string): string {
  if (!datetimeLocal) return new Date().toISOString();
  return new Date(datetimeLocal).toISOString();
}
