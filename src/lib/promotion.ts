export const PASS_OUT = "__pass_out";

export type ClassRow = { id: string; name: string; section: string };

export const classLabel = (c: Pick<ClassRow, "name" | "section">) => `${c.name} - ${c.section}`;

// Classes below Class 1, in the order students move through them.
const PRIMARY_ORDER = ["pre-nursery", "nursery", "lkg", "ukg", "class 1"];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The class a student normally moves to next: "Class 5" -> "Class 6" in the same section, and "Nursery" -> "LKG" -> "UKG" -> "Class 1".
 * Returns null when there is no obvious next class (for example after the last class), so the admin chooses.
 */
export function suggestNextClass(from: ClassRow, classes: ClassRow[]): ClassRow | null {
  const sameSection = classes.filter((c) => c.id !== from.id && norm(c.section) === norm(from.section));
  const find = (name: string) => sameSection.find((c) => norm(c.name) === norm(name)) ?? null;

  const idx = PRIMARY_ORDER.indexOf(norm(from.name));
  if (idx >= 0 && idx < PRIMARY_ORDER.length - 1) return find(PRIMARY_ORDER[idx + 1]);

  const m = /^(.*?)(\d+)(\D*)$/.exec(from.name.trim());
  if (!m) return null;
  return find(`${m[1]}${Number(m[2]) + 1}${m[3]}`);
}
