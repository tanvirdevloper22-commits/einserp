import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { inr } from "@/lib/format";
import { TYPE_LABEL, clock, seatsLeft, type Route, type Stop, type Vehicle } from "@/lib/transport";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { addStop, assignStudents, deleteRoute, deleteStop, removeStudent, updateRoute } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Route" };

type SP = { error?: string; added?: string; saved?: string; stop?: string; assigned?: string; removed?: string; q?: string };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
type Rider = { student_id: string; stop_id: string | null; students: { full_name: string; admission_no: string; classes: { name: string; section: string } | { name: string; section: string }[] | null } | { full_name: string; admission_no: string; classes: { name: string; section: string } | { name: string; section: string }[] | null }[] | null };

export default async function RoutePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "accountant", "teacher"]);
  const isAdmin = me.role === "admin";
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const { data: routeData } = await supabase.from("transport_routes").select("*").eq("id", id).maybeSingle();
  if (!routeData) notFound();
  const route = routeData as Route;

  const q = (sp.q ?? "").trim().replace(/[%,()]/g, " ").slice(0, 40);
  const [vehicleRes, stopsRes, ridersRes, vehiclesRes] = await Promise.all([
    route.vehicle_id ? supabase.from("transport_vehicles").select("*").eq("id", route.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("transport_stops").select("*").eq("route_id", id).order("sort_order"),
    supabase.from("student_transport").select("student_id, stop_id, students(full_name, admission_no, classes(name, section))").eq("route_id", id).limit(500),
    isAdmin ? supabase.from("transport_vehicles").select("id, reg_no, capacity, status").order("reg_no") : Promise.resolve({ data: [] }),
  ]);
  const vehicle = (vehicleRes.data ?? null) as Vehicle | null;
  const stops = (stopsRes.data ?? []) as Stop[];
  const riders = ((ridersRes.data ?? []) as unknown as Rider[])
    .map((r) => ({ ...r, s: one(r.students) }))
    .sort((a, b) => (a.s?.full_name ?? "").localeCompare(b.s?.full_name ?? ""));
  const stopName = new Map(stops.map((s) => [s.id, s]));
  const left = seatsLeft(vehicle, riders.length);

  // Students who can still be added: active and not on any route. Searched by name or admission number.
  let candidates: { id: string; full_name: string; admission_no: string; classes: { name: string; section: string } | { name: string; section: string }[] | null }[] = [];
  if (isAdmin && q.length >= 2) {
    const { data: found } = await supabase
      .from("students")
      .select("id, full_name, admission_no, classes(name, section)")
      .eq("status", "active")
      .or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
      .order("full_name")
      .limit(60);
    const ids = (found ?? []).map((s) => s.id as string);
    const { data: taken } = ids.length ? await supabase.from("student_transport").select("student_id, route_id").in("student_id", ids) : { data: [] };
    const takenIds = new Set((taken ?? []).map((t) => t.student_id as string));
    candidates = (found ?? []).filter((s) => !takenIds.has(s.id as string)).slice(0, 30) as typeof candidates;
  }

  return (
    <>
      <PageHeader title={route.name} description={`${inr(Number(route.monthly_fee))} per month${vehicle ? ` · ${vehicle.reg_no}` : " · no vehicle"}`}>
        <Link className="btn ghost" href="/transport">Back</Link>
      </PageHeader>

      {sp.added && <div className="notice ok">Route created. Now add its stops and students.</div>}
      {sp.saved && <div className="notice ok">Saved.</div>}
      {sp.stop && <div className="notice ok">{sp.stop === "removed" ? "Stop removed." : "Stop added."}</div>}
      {sp.assigned && <div className="notice ok">{sp.assigned} student{sp.assigned === "1" ? "" : "s"} added to this route.</div>}
      {sp.removed && <div className="notice ok">Student removed from this route.</div>}
      {sp.error && <div className="error">{sp.error}</div>}

      <div className="grid stats">
        <div className="card stat"><span className="label">Students</span><span className="value">{riders.length}</span></div>
        <div className="card stat"><span className="label">Seats left</span><span className="value">{left === null ? "-" : left}</span></div>
        <div className="card stat"><span className="label">Monthly total</span><span className="value">{inr(Number(route.monthly_fee) * riders.length)}</span></div>
      </div>
      {vehicle && (
        <p className="sub" style={{ marginTop: -8 }}>
          {TYPE_LABEL[vehicle.vehicle_type] ?? vehicle.vehicle_type} {vehicle.reg_no} · {vehicle.capacity} seats
          {vehicle.driver_name ? ` · Driver ${vehicle.driver_name}` : ""}{vehicle.driver_phone ? ` (${vehicle.driver_phone})` : ""}
        </p>
      )}

      <h2 style={{ margin: "0 0 8px" }}>Stops</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {stops.length === 0 ? <p className="sub" style={{ padding: 16 }}>No stops yet.</p> : (
          <table>
            <thead><tr><th>#</th><th>Stop</th><th>Pickup time</th><th className="num">Students</th><th /></tr></thead>
            <tbody>
              {stops.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td className="strong">{s.name}</td>
                  <td>{clock(s.pickup_time) || <span className="muted">-</span>}</td>
                  <td className="num">{riders.filter((r) => r.stop_id === s.id).length}</td>
                  <td className="num">
                    {isAdmin && (
                      <form action={deleteStop}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="route_id" value={id} />
                        <ConfirmButton className="btn ghost small" message={`Remove the stop "${s.name}"? Students at this stop stay on the route.`}>Remove</ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isAdmin && (
          <form action={addStop} className="row tight" style={{ padding: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input type="hidden" name="route_id" value={id} />
            <div><label htmlFor="stop_name">Stop name</label><input id="stop_name" name="name" required maxLength={80} /></div>
            <div><label htmlFor="pickup_time">Pickup time</label><input id="pickup_time" name="pickup_time" type="time" /></div>
            <button className="btn small">Add stop</button>
          </form>
        )}
      </div>

      <h2 style={{ margin: "0 0 8px" }}>Students on this route</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {riders.length === 0 ? <p className="sub" style={{ padding: 16 }}>No students yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Class</th><th>Stop</th><th /></tr></thead>
              <tbody>
                {riders.map((r) => {
                  const c = one(r.s?.classes);
                  const stop = r.stop_id ? stopName.get(r.stop_id) : null;
                  return (
                    <tr key={r.student_id}>
                      <td><span className="strong">{r.s?.full_name ?? "Student"}</span><span className="cell-sub">Adm. no. {r.s?.admission_no}</span></td>
                      <td>{c ? `${c.name} - ${c.section}` : "-"}</td>
                      <td>{stop ? <>{stop.name}{stop.pickup_time ? <span className="cell-sub">{clock(stop.pickup_time)}</span> : null}</> : <span className="muted">-</span>}</td>
                      <td className="num">
                        {isAdmin && (
                          <form action={removeStudent}>
                            <input type="hidden" name="student_id" value={r.student_id} /><input type="hidden" name="route_id" value={id} />
                            <ConfirmButton className="btn ghost small" message={`Remove ${r.s?.full_name ?? "this student"} from the route?`}>Remove</ConfirmButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Add students</h2>
            <form method="get" className="row tight" style={{ alignItems: "flex-end", marginBottom: 12 }}>
              <div><label htmlFor="q">Search by name or admission number</label><input id="q" name="q" defaultValue={q} minLength={2} placeholder="At least 2 letters" /></div>
              <button className="btn ghost">Search</button>
            </form>
            {q.length >= 2 && candidates.length === 0 && <p className="sub">No active student found who is not already on a route.</p>}
            {candidates.length > 0 && (
              <form action={assignStudents}>
                <input type="hidden" name="route_id" value={id} />
                <div className="table-wrap">
                  <table>
                    <tbody>
                      {candidates.map((s) => {
                        const c = one(s.classes);
                        return (
                          <tr key={s.id}>
                            <td style={{ width: 32 }}><input type="checkbox" name="student" value={s.id} aria-label={`Select ${s.full_name}`} /></td>
                            <td className="strong">{s.full_name}</td>
                            <td>Adm. no. {s.admission_no}</td>
                            <td>{c ? `${c.name} - ${c.section}` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="row tight" style={{ marginTop: 12, alignItems: "flex-end" }}>
                  <div>
                    <label htmlFor="stop_id">Stop</label>
                    <select id="stop_id" name="stop_id" defaultValue=""><option value="">No stop selected</option>{stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                  <button className="btn">Add selected students</button>
                </div>
              </form>
            )}
          </div>

          <form action={updateRoute} className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Route details</h2>
            <input type="hidden" name="id" value={id} />
            <div className="form-grid">
              <div><label htmlFor="name">Route name</label><input id="name" name="name" required maxLength={80} defaultValue={route.name} /></div>
              <div><label htmlFor="monthly_fee">Monthly fee (₹)</label><input id="monthly_fee" name="monthly_fee" inputMode="decimal" required defaultValue={String(route.monthly_fee)} /></div>
              <div>
                <label htmlFor="vehicle_id">Vehicle</label>
                <select id="vehicle_id" name="vehicle_id" defaultValue={route.vehicle_id ?? ""}>
                  <option value="">No vehicle</option>
                  {((vehiclesRes.data ?? []) as { id: string; reg_no: string; capacity: number; status: string }[]).filter((x) => x.status === "active" || x.id === route.vehicle_id).map((x) => <option key={x.id} value={x.id}>{x.reg_no} ({x.capacity} seats)</option>)}
                </select>
              </div>
              <div><label htmlFor="notes">Notes</label><input id="notes" name="notes" maxLength={300} defaultValue={route.notes ?? ""} /></div>
            </div>
            <p className="sub">A change in the monthly fee applies to fees generated from now on, not to fees already created.</p>
            <div className="row" style={{ marginTop: 12 }}><button className="btn">Save route</button></div>
          </form>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Delete route</h2>
            <p className="sub">A route can only be deleted once no student is on it.</p>
            <form action={deleteRoute}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton className="btn ghost" message={`Delete the route "${route.name}" and its stops?`}>Delete route</ConfirmButton>
            </form>
          </div>
        </>
      )}
    </>
  );
}
