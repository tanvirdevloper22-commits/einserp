"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseMoney } from "@/lib/payroll";
import { isDate, isTime, isVehicleType, transportFeeTitle } from "@/lib/transport";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9+\-\s()]{7,20}$/;
const MISSING = "The transport tables are missing. Run supabase/025_transport.sql in the Supabase SQL Editor first.";
const explain = (m: string) => (/transport_|student_transport|schema cache|does not exist/i.test(m) ? MISSING : m);
const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (path: string, qs: string): never => redirect(`${path}?${qs}`);
const err = (path: string, m: string): never => go(path, `error=${encodeURIComponent(m)}`);

function refresh() {
  revalidatePath("/transport");
  revalidatePath("/portal");
}

// ---------- vehicles ----------

function readVehicle(f: FormData, back: string) {
  const reg = t(f, "reg_no").toUpperCase();
  const type = t(f, "vehicle_type");
  const capacity = Number(t(f, "capacity"));
  const phone = t(f, "driver_phone");
  const ins = t(f, "insurance_expiry");
  const fit = t(f, "fitness_expiry");
  if (reg.length < 3 || reg.length > 20) err(back, "Enter the registration number, for example UP32 AB 1234.");
  if (!isVehicleType(type)) err(back, "Choose the type of vehicle.");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) err(back, "The number of seats must be between 1 and 200.");
  if (phone && !PHONE.test(phone)) err(back, "The driver's phone number does not look right.");
  if ((ins && !isDate(ins)) || (fit && !isDate(fit))) err(back, "One of the expiry dates is not valid.");
  return {
    reg_no: reg,
    vehicle_type: type,
    capacity,
    driver_name: t(f, "driver_name").slice(0, 80) || null,
    driver_phone: phone || null,
    attendant_name: t(f, "attendant_name").slice(0, 80) || null,
    insurance_expiry: ins || null,
    fitness_expiry: fit || null,
    status: t(f, "status") === "inactive" ? "inactive" : "active",
  };
}

export async function addVehicle(formData: FormData) {
  await requireRole(["admin"]);
  const row = readVehicle(formData, "/transport");
  const supabase = await createClient();
  const { error } = await supabase.from("transport_vehicles").insert(row);
  if (error) err("/transport", error.code === "23505" ? `Vehicle ${row.reg_no} is already added.` : explain(error.message));
  refresh();
  return go("/transport", "added=vehicle");
}

export async function updateVehicle(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return redirect("/transport");
  const back = `/transport/vehicles/${id}`;
  const row = readVehicle(formData, back);
  const supabase = await createClient();
  const { error } = await supabase.from("transport_vehicles").update(row).eq("id", id);
  if (error) err(back, error.code === "23505" ? `Vehicle ${row.reg_no} is already added.` : explain(error.message));
  refresh();
  return go("/transport", "saved=vehicle");
}

export async function deleteVehicle(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("transport_vehicles").delete().eq("id", id); // routes using it just lose the vehicle
  refresh();
  redirect("/transport?deleted=vehicle");
}

// ---------- routes ----------

function readRoute(f: FormData, back: string) {
  const name = t(f, "name");
  const fee = parseMoney(t(f, "monthly_fee"));
  const vehicle = t(f, "vehicle_id");
  const notes = t(f, "notes");
  if (!name || name.length > 80) err(back, "Enter the route name (up to 80 characters).");
  if (fee === null) err(back, "Enter the monthly fee as a number, for example 800 or 800.50.");
  if (vehicle && !UUID.test(vehicle)) err(back, "Choose a valid vehicle.");
  if (notes.length > 300) err(back, "The notes can be at most 300 characters.");
  return { name, monthly_fee: fee ?? 0, vehicle_id: vehicle || null, notes: notes || null };
}

export async function addRoute(formData: FormData) {
  await requireRole(["admin"]);
  const row = readRoute(formData, "/transport");
  const supabase = await createClient();
  const { data, error } = await supabase.from("transport_routes").insert(row).select("id").single();
  if (error || !data) return err("/transport", error?.code === "23505" ? `A route named "${row.name}" already exists.` : explain(error?.message ?? "The route could not be saved."));
  refresh();
  return go(`/transport/routes/${data.id}`, "added=1");
}

export async function updateRoute(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return redirect("/transport");
  const back = `/transport/routes/${id}`;
  const row = readRoute(formData, back);
  const supabase = await createClient();
  const { error } = await supabase.from("transport_routes").update(row).eq("id", id);
  if (error) err(back, error.code === "23505" ? `A route named "${row.name}" already exists.` : explain(error.message));
  refresh();
  return go(back, "saved=1");
}

export async function deleteRoute(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("transport_routes").delete().eq("id", id);
  if (error) err(`/transport/routes/${id}`, error.code === "23503" ? "This route still has students. Remove them from the route first." : explain(error.message));
  refresh();
  redirect("/transport?deleted=route");
}

// ---------- stops ----------

export async function addStop(formData: FormData) {
  await requireRole(["admin"]);
  const routeId = t(formData, "route_id");
  if (!UUID.test(routeId)) return redirect("/transport");
  const back = `/transport/routes/${routeId}`;
  const name = t(formData, "name");
  const time = t(formData, "pickup_time");
  if (!name || name.length > 80) err(back, "Enter the stop name.");
  if (time && !isTime(time)) err(back, "The pickup time is not valid.");

  const supabase = await createClient();
  const { data: last } = await supabase.from("transport_stops").select("sort_order").eq("route_id", routeId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("transport_stops").insert({ route_id: routeId, name, pickup_time: time || null, sort_order: ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1 });
  if (error) err(back, explain(error.message));
  refresh();
  return go(back, "stop=1");
}

export async function deleteStop(formData: FormData) {
  await requireRole(["admin"]);
  const id = t(formData, "id");
  const routeId = t(formData, "route_id");
  if (!UUID.test(id) || !UUID.test(routeId)) return;
  const supabase = await createClient();
  await supabase.from("transport_stops").delete().eq("id", id).eq("route_id", routeId); // students on it keep the route, just no stop
  refresh();
  return go(`/transport/routes/${routeId}`, "stop=removed");
}

// ---------- students on a route ----------

export async function assignStudents(formData: FormData) {
  await requireRole(["admin"]);
  const routeId = t(formData, "route_id");
  if (!UUID.test(routeId)) return redirect("/transport");
  const back = `/transport/routes/${routeId}`;
  const stopId = t(formData, "stop_id");
  const ids = [...new Set(formData.getAll("student").map(String))].filter((s) => UUID.test(s));
  if (!ids.length) err(back, "Tick at least one student.");
  if (stopId && !UUID.test(stopId)) err(back, "Choose a valid stop.");

  const supabase = await createClient();
  const { data: route } = await supabase.from("transport_routes").select("id, vehicle_id").eq("id", routeId).maybeSingle();
  if (!route) err("/transport", "That route could not be found.");

  if (stopId) {
    const { data: stop } = await supabase.from("transport_stops").select("id").eq("id", stopId).eq("route_id", routeId).maybeSingle();
    if (!stop) err(back, "That stop does not belong to this route.");
  }

  if (route!.vehicle_id) {
    const [{ data: v }, { count }] = await Promise.all([
      supabase.from("transport_vehicles").select("capacity, reg_no").eq("id", route!.vehicle_id).maybeSingle(),
      supabase.from("student_transport").select("student_id", { count: "exact", head: true }).eq("route_id", routeId),
    ]);
    const already = new Set<string>();
    if (v) {
      const { data: mine } = await supabase.from("student_transport").select("student_id").eq("route_id", routeId).in("student_id", ids);
      (mine ?? []).forEach((m) => already.add(m.student_id as string));
      const adding = ids.length - already.size;
      const left = (v.capacity as number) - (count ?? 0);
      if (adding > left) err(back, `Vehicle ${v.reg_no} has only ${Math.max(0, left)} seat${left === 1 ? "" : "s"} left, and you ticked ${adding} new student${adding === 1 ? "" : "s"}.`);
    }
  }

  const { error } = await supabase
    .from("student_transport")
    .upsert(ids.map((student_id) => ({ student_id, route_id: routeId, stop_id: stopId || null })), { onConflict: "student_id" });
  if (error) err(back, explain(error.message));
  refresh();
  return go(back, `assigned=${ids.length}`);
}

export async function removeStudent(formData: FormData) {
  await requireRole(["admin"]);
  const studentId = t(formData, "student_id");
  const routeId = t(formData, "route_id");
  if (!UUID.test(studentId) || !UUID.test(routeId)) return;
  const supabase = await createClient();
  await supabase.from("student_transport").delete().eq("student_id", studentId).eq("route_id", routeId);
  refresh();
  return go(`/transport/routes/${routeId}`, "removed=1");
}

// ---------- monthly fees ----------

/**
 * Creates one transport fee per student who uses transport, for the given period (e.g. "Nov 2026"), at their route's monthly fee.
 * A student who already has the fee for that period is skipped, so running it twice never doubles the charge.
 */
export async function generateTransportFees(formData: FormData) {
  await requireRole(["admin", "accountant"]);
  const period = t(formData, "period");
  const due = t(formData, "due_date");
  if (!period || period.length > 30) err("/transport", "Enter the period, for example Nov 2026.");
  if (due && !isDate(due)) err("/transport", "The due date is not valid.");
  const title = transportFeeTitle(period);

  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("student_transport")
    .select("student_id, transport_routes(monthly_fee), students!inner(status)")
    .eq("students.status", "active")
    .limit(5000);
  if (error) err("/transport", explain(error.message));

  const fee = (r: { transport_routes: { monthly_fee: number } | { monthly_fee: number }[] | null }) => {
    const x = Array.isArray(r.transport_routes) ? r.transport_routes[0] : r.transport_routes;
    return Number(x?.monthly_fee ?? 0);
  };
  const eligible = (links ?? []).map((l) => ({ student_id: l.student_id as string, amount: fee(l as never) })).filter((l) => l.amount > 0);
  if (!eligible.length) err("/transport", "No student is on a route with a monthly fee, so there is nothing to generate.");

  const have = new Set<string>();
  for (let i = 0; i < eligible.length; i += 100) {
    const part = eligible.slice(i, i + 100).map((e) => e.student_id);
    const { data: existing } = await supabase.from("fees").select("student_id").eq("title", title).in("student_id", part);
    (existing ?? []).forEach((e) => have.add(e.student_id as string));
  }
  const rows = eligible.filter((e) => !have.has(e.student_id)).map((e) => ({ student_id: e.student_id, title, amount: e.amount, due_date: due || null }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error: insertError } = await supabase.from("fees").insert(rows.slice(i, i + 200));
    if (insertError) err("/transport", `Some fees may have been created before this error: ${insertError.message}. Run it again to add the rest.`);
  }
  revalidatePath("/fees");
  return go("/transport", `generated=${rows.length}&skipped=${eligible.length - rows.length}`);
}
