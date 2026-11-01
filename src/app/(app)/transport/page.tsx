import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { inr } from "@/lib/format";
import { VEHICLE_TYPES, TYPE_LABEL, expiryState, type Vehicle, type Route } from "@/lib/transport";
import PageHeader from "@/components/PageHeader";
import { addRoute, addVehicle, generateTransportFees } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transport" };

type SP = { error?: string; added?: string; saved?: string; deleted?: string; generated?: string; skipped?: string };

function Expiry({ date, today }: { date: string | null; today: string }) {
  const s = expiryState(date, today);
  if (!s) return <span className="muted">-</span>;
  return (
    <>
      {formatDate(date as string)}
      <span className={`badge ${s === "expired" ? "bad" : s === "soon" ? "warn" : "ok"}`} style={{ marginLeft: 6 }}>
        {s === "expired" ? "Expired" : s === "soon" ? "Ending soon" : "Valid"}
      </span>
    </>
  );
}

export default async function TransportPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole(["admin", "accountant", "teacher"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const isAdmin = me.role === "admin";
  const canBill = isAdmin || me.role === "accountant";
  const today = todayISO();

  const [v, r, s, st] = await Promise.all([
    supabase.from("transport_vehicles").select("*").order("reg_no"),
    supabase.from("transport_routes").select("*").order("name"),
    supabase.from("transport_stops").select("route_id"),
    supabase.from("student_transport").select("route_id"),
  ]);
  const vehicles = (v.data ?? []) as Vehicle[];
  const routes = (r.data ?? []) as Route[];
  const failed = v.error ?? r.error ?? s.error ?? st.error;

  const stopCount = new Map<string, number>();
  (s.data ?? []).forEach((x) => stopCount.set(x.route_id as string, (stopCount.get(x.route_id as string) ?? 0) + 1));
  const riders = new Map<string, number>();
  (st.data ?? []).forEach((x) => riders.set(x.route_id as string, (riders.get(x.route_id as string) ?? 0) + 1));
  const vById = new Map(vehicles.map((x) => [x.id, x]));
  const total = (st.data ?? []).length;
  const monthly = routes.reduce((sum, x) => sum + Number(x.monthly_fee) * (riders.get(x.id) ?? 0), 0);
  const period = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Transport" description="Vehicles, routes, stops and the students who travel by school transport." />

      {sp.added && <div className="notice ok">{sp.added === "vehicle" ? "Vehicle added." : "Added."}</div>}
      {sp.saved && <div className="notice ok">Saved.</div>}
      {sp.deleted && <div className="notice ok">Deleted.</div>}
      {sp.generated !== undefined && (
        <div className="notice ok">
          {Number(sp.generated)} transport fee{Number(sp.generated) === 1 ? "" : "s"} created
          {Number(sp.skipped) > 0 ? `; ${sp.skipped} skipped because they already exist for this period` : ""}.
        </div>
      )}
      {sp.error && <div className="error">{sp.error}</div>}
      {failed && (
        <div className="error">
          {/schema cache|transport_|does not exist|relationship/i.test(failed.message)
            ? "The transport tables are missing, or Supabase has not noticed them yet. Run supabase/025_transport.sql, then run: notify pgrst, 'reload schema';"
            : `Transport could not be loaded: ${failed.message}`}
        </div>
      )}

      <div className="grid stats">
        <div className="card stat"><span className="label">Vehicles</span><span className="value">{vehicles.length}</span></div>
        <div className="card stat"><span className="label">Routes</span><span className="value">{routes.length}</span></div>
        <div className="card stat"><span className="label">Students on transport</span><span className="value">{total}</span></div>
        <div className="card stat"><span className="label">Monthly transport fees</span><span className="value">{inr(monthly)}</span></div>
      </div>

      <h2 style={{ margin: "0 0 8px" }}>Routes</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {routes.length === 0 ? (
          <p className="sub" style={{ padding: 16 }}>No routes yet.{isAdmin ? " Add one below." : ""}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Route</th><th>Vehicle</th><th className="num">Stops</th><th className="num">Students</th><th className="num">Monthly fee</th></tr></thead>
              <tbody>
                {routes.map((x) => {
                  const veh = x.vehicle_id ? vById.get(x.vehicle_id) : null;
                  const n = riders.get(x.id) ?? 0;
                  const full = veh ? n >= veh.capacity : false;
                  return (
                    <tr key={x.id}>
                      <td><Link className="strong" href={`/transport/routes/${x.id}`}>{x.name}</Link></td>
                      <td>{veh ? `${veh.reg_no} (${TYPE_LABEL[veh.vehicle_type] ?? veh.vehicle_type})` : <span className="muted">No vehicle</span>}</td>
                      <td className="num">{stopCount.get(x.id) ?? 0}</td>
                      <td className="num">{n}{veh ? ` / ${veh.capacity}` : ""}{full && <span className="badge warn" style={{ marginLeft: 6 }}>Full</span>}</td>
                      <td className="num">{inr(Number(x.monthly_fee))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 style={{ margin: "0 0 8px" }}>Vehicles</h2>
      <div className="card flush" style={{ marginBottom: 24 }}>
        {vehicles.length === 0 ? (
          <p className="sub" style={{ padding: 16 }}>No vehicles yet.{isAdmin ? " Add one below." : ""}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Registration</th><th>Driver</th><th className="num">Seats</th><th>Insurance</th><th>Fitness</th><th>Status</th></tr></thead>
              <tbody>
                {vehicles.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {isAdmin ? <Link className="strong" href={`/transport/vehicles/${x.id}`}>{x.reg_no}</Link> : <span className="strong">{x.reg_no}</span>}
                      <span className="cell-sub">{TYPE_LABEL[x.vehicle_type] ?? x.vehicle_type}</span>
                    </td>
                    <td>
                      {x.driver_name ?? <span className="muted">-</span>}
                      <span className="cell-sub">{[x.driver_phone, x.attendant_name ? `Attendant: ${x.attendant_name}` : ""].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="num">{x.capacity}</td>
                    <td><Expiry date={x.insurance_expiry} today={today} /></td>
                    <td><Expiry date={x.fitness_expiry} today={today} /></td>
                    <td><span className={`badge ${x.status === "active" ? "ok" : "neutral"}`}>{x.status === "active" ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canBill && (
        <form action={generateTransportFees} className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Generate transport fees</h2>
          <p className="sub">Creates one fee for every active student on a route that has a monthly fee. A student who already has the fee for the same period is skipped, so it is safe to run again.</p>
          <div className="form-grid">
            <div><label htmlFor="period">Period</label><input id="period" name="period" required maxLength={30} defaultValue={period} placeholder="e.g. Nov 2026" /></div>
            <div><label htmlFor="due_date">Due date (optional)</label><input id="due_date" name="due_date" type="date" /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}><button className="btn">Generate fees</button></div>
        </form>
      )}

      {isAdmin && (
        <div className="grid two">
          <form action={addVehicle} className="card">
            <h2 style={{ marginTop: 0 }}>Add vehicle</h2>
            <div className="form-grid">
              <div><label htmlFor="reg_no">Registration number</label><input id="reg_no" name="reg_no" required maxLength={20} placeholder="UP32 AB 1234" /></div>
              <div>
                <label htmlFor="vehicle_type">Type</label>
                <select id="vehicle_type" name="vehicle_type" defaultValue="bus">{VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
              </div>
              <div><label htmlFor="capacity">Seats</label><input id="capacity" name="capacity" type="number" min={1} max={200} required defaultValue={40} /></div>
              <div><label htmlFor="driver_name">Driver name</label><input id="driver_name" name="driver_name" maxLength={80} /></div>
              <div><label htmlFor="driver_phone">Driver phone</label><input id="driver_phone" name="driver_phone" inputMode="tel" maxLength={20} /></div>
              <div><label htmlFor="attendant_name">Attendant name</label><input id="attendant_name" name="attendant_name" maxLength={80} /></div>
              <div><label htmlFor="insurance_expiry">Insurance valid until</label><input id="insurance_expiry" name="insurance_expiry" type="date" /></div>
              <div><label htmlFor="fitness_expiry">Fitness certificate valid until</label><input id="fitness_expiry" name="fitness_expiry" type="date" /></div>
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn">Add vehicle</button></div>
          </form>

          <form action={addRoute} className="card">
            <h2 style={{ marginTop: 0 }}>Add route</h2>
            <div className="form-grid">
              <div><label htmlFor="name">Route name</label><input id="name" name="name" required maxLength={80} placeholder="e.g. Civil Lines - School" /></div>
              <div><label htmlFor="monthly_fee">Monthly fee (₹)</label><input id="monthly_fee" name="monthly_fee" inputMode="decimal" required defaultValue="0" /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="vehicle_id">Vehicle</label>
                <select id="vehicle_id" name="vehicle_id" defaultValue="">
                  <option value="">No vehicle yet</option>
                  {vehicles.filter((x) => x.status === "active").map((x) => <option key={x.id} value={x.id}>{x.reg_no} ({x.capacity} seats)</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}><label htmlFor="notes">Notes (optional)</label><input id="notes" name="notes" maxLength={300} /></div>
            </div>
            <p className="sub">After adding the route you can add its stops and students.</p>
            <div className="row" style={{ marginTop: 12 }}><button className="btn">Add route</button></div>
          </form>
        </div>
      )}
    </>
  );
}
