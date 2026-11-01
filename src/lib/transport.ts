export const VEHICLE_TYPES = [
  { value: "bus", label: "Bus" },
  { value: "van", label: "Van" },
  { value: "auto", label: "Auto" },
  { value: "other", label: "Other" },
] as const;
export const TYPE_LABEL = Object.fromEntries(VEHICLE_TYPES.map((v) => [v.value, v.label])) as Record<string, string>;
export const isVehicleType = (v: string) => VEHICLE_TYPES.some((t) => t.value === v);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isDate = (v: string) => DATE.test(v);
export const isTime = (v: string) => TIME.test(v);

/** "07:30" or "07:30:00" as "7:30 AM". */
export function clock(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** Whether a document date (insurance, fitness certificate) has run out, runs out within 30 days, or is fine. */
export function expiryState(date: string | null | undefined, today: string): "expired" | "soon" | "ok" | null {
  if (!date) return null;
  if (date < today) return "expired";
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  return date <= limit.toISOString().slice(0, 10) ? "soon" : "ok";
}

/** The fee title used for one month of transport; generating twice for the same month is skipped by this title. */
export const transportFeeTitle = (period: string) => `Transport - ${period.trim()}`;

export type Vehicle = {
  id: string;
  reg_no: string;
  vehicle_type: string;
  capacity: number;
  driver_name: string | null;
  driver_phone: string | null;
  attendant_name: string | null;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  status: "active" | "inactive";
};

export type Route = {
  id: string;
  name: string;
  vehicle_id: string | null;
  monthly_fee: number;
  notes: string | null;
};

export type Stop = { id: string; route_id: string; name: string; pickup_time: string | null; sort_order: number };

/** How many more students a route can take, or null when it has no vehicle (no limit is known). */
export function seatsLeft(vehicle: Pick<Vehicle, "capacity"> | null | undefined, onRoute: number): number | null {
  return vehicle ? Math.max(0, vehicle.capacity - onRoute) : null;
}
