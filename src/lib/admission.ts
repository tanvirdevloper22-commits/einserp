/** A prefix is up to 12 letters, digits or / _ . - . Anything else is dropped. */
export function cleanPrefix(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, "").replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, 12);
}

/**
 * The next admission number after the ones already used: the prefix followed by the highest number that follows it, plus one.
 * The number keeps its width (EINS/0012 gives EINS/0013) and starts at 0001 for a new prefix.
 * With no prefix and no plain numbers in use, nothing is suggested so a wrong "1" is never filled in.
 */
export function nextAdmissionNo(used: string[], prefix: string): string {
  const p = cleanPrefix(prefix);
  const tail = used
    .filter((n) => n.toLowerCase().startsWith(p.toLowerCase()))
    .map((n) => n.slice(p.length))
    .filter((rest) => /^\d{1,9}$/.test(rest));
  if (!tail.length) return p ? `${p}0001` : "";
  const top = tail.reduce((a, b) => (Number(b) > Number(a) ? b : a));
  const next = String(Number(top) + 1);
  return p + next.padStart(Math.max(top.length, next.length), "0");
}
