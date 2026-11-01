import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { VEHICLE_TYPES, type Vehicle } from "@/lib/transport";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteVehicle, updateVehicle } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vehicle" };

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("transport_vehicles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const v = data as Vehicle;
  const { data: used } = await supabase.from("transport_routes").select("id, name").eq("vehicle_id", id);

  return (
    <>
      <PageHeader title={v.reg_no} description="Edit the vehicle, driver and document dates.">
        <Link className="btn ghost" href="/transport">Back</Link>
      </PageHeader>
      {sp.error && <div className="error">{sp.error}</div>}

      <form action={updateVehicle} className="card" style={{ marginBottom: 24 }}>
        <input type="hidden" name="id" value={v.id} />
        <div className="form-grid">
          <div><label htmlFor="reg_no">Registration number</label><input id="reg_no" name="reg_no" required maxLength={20} defaultValue={v.reg_no} /></div>
          <div>
            <label htmlFor="vehicle_type">Type</label>
            <select id="vehicle_type" name="vehicle_type" defaultValue={v.vehicle_type}>{VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          <div><label htmlFor="capacity">Seats</label><input id="capacity" name="capacity" type="number" min={1} max={200} required defaultValue={v.capacity} /></div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={v.status}><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          <div><label htmlFor="driver_name">Driver name</label><input id="driver_name" name="driver_name" maxLength={80} defaultValue={v.driver_name ?? ""} /></div>
          <div><label htmlFor="driver_phone">Driver phone</label><input id="driver_phone" name="driver_phone" maxLength={20} defaultValue={v.driver_phone ?? ""} /></div>
          <div><label htmlFor="attendant_name">Attendant name</label><input id="attendant_name" name="attendant_name" maxLength={80} defaultValue={v.attendant_name ?? ""} /></div>
          <div><label htmlFor="insurance_expiry">Insurance valid until</label><input id="insurance_expiry" name="insurance_expiry" type="date" defaultValue={v.insurance_expiry ?? ""} /></div>
          <div><label htmlFor="fitness_expiry">Fitness certificate valid until</label><input id="fitness_expiry" name="fitness_expiry" type="date" defaultValue={v.fitness_expiry ?? ""} /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}><button className="btn">Save changes</button></div>
      </form>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Delete vehicle</h2>
        <p className="sub">
          {(used ?? []).length > 0
            ? `Used by ${(used ?? []).map((r) => r.name).join(", ")}. Deleting it leaves those routes without a vehicle; students stay on their routes.`
            : "This vehicle is not used by any route."}
        </p>
        <form action={deleteVehicle}>
          <input type="hidden" name="id" value={v.id} />
          <ConfirmButton className="btn ghost" message={`Delete vehicle ${v.reg_no}?`}>Delete vehicle</ConfirmButton>
        </form>
      </div>
    </>
  );
}
