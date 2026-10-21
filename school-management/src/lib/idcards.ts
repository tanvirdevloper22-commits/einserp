export const PER_SHEET = 9; // 3 columns x 3 rows of 54 x 86 mm cards on one A4 page
export const COLS = 3;

/** Splits a list into sheets of PER_SHEET cards. */
export function toSheets<T>(items: T[]): T[][] {
  const sheets: T[][] = [];
  for (let i = 0; i < items.length; i += PER_SHEET) sheets.push(items.slice(i, i + PER_SHEET));
  return sheets;
}

/**
 * Backs are printed on the reverse side of the sheet. With a long-edge flip, the back of the card in column 1
 * lands in column 3, so each row of backs is mirrored. Missing cards stay as blank slots to keep alignment.
 */
export function mirrorRows<T>(cards: T[]): (T | null)[] {
  const out: (T | null)[] = [];
  for (let i = 0; i < cards.length; i += COLS) {
    const row: (T | null)[] = cards.slice(i, i + COLS);
    while (row.length < COLS) row.push(null);
    out.push(...row.reverse());
  }
  return out;
}
