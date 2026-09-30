const CODE_RE = /^[A-Z0-9-]{4,32}$/;

export function normalizeCode(raw: string): string | null {
  const code = raw.toUpperCase().trim();
  return CODE_RE.test(code) ? code : null;
}
