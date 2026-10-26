"use client";

import Link from "next/link";
import { useActionState } from "react";
import { DESIGNATIONS, GENDERS, STAFF_TYPE_LABEL, type StaffFormState, type StaffInput } from "@/lib/staff";
import type { AccountOption, ClassOption } from "@/lib/staff-options";

type Props = {
  action: (prev: StaffFormState, formData: FormData) => Promise<StaffFormState>;
  initial: StaffInput;
  classOptions: ClassOption[];
  accountOptions: AccountOption[];
  mode: "create" | "update";
  today: string;
};

export default function StaffForm({ action, initial, classOptions, accountOptions, mode, today }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as StaffFormState);
  // After a failed save React clears the fields, so refill them from what the server sent back.
  const v = state.values ?? initial;

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="error" role="alert">{state.error}</div>}

      <div className="card">
        <h2>Basic details</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="employee_no">Employee number</label>
            <input id="employee_no" name="employee_no" required defaultValue={v.employee_no} placeholder="e.g. EMP-001" />
          </div>
          <div>
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" name="full_name" required defaultValue={v.full_name} />
          </div>
          <div>
            <label htmlFor="staff_type">Type</label>
            <select id="staff_type" name="staff_type" defaultValue={v.staff_type}>
              {Object.entries(STAFF_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="designation">Designation</label>
            <input id="designation" name="designation" list="designations" defaultValue={v.designation} placeholder="e.g. Teacher" />
            <datalist id="designations">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
          <div>
            <label htmlFor="subjects">Subjects taught</label>
            <input id="subjects" name="subjects" defaultValue={v.subjects} placeholder="e.g. Maths, Physics" />
          </div>
          <div>
            <label htmlFor="qualification">Qualification</label>
            <input id="qualification" name="qualification" defaultValue={v.qualification} placeholder="e.g. B.Ed, M.Sc" />
          </div>
          <div>
            <label htmlFor="gender">Gender</label>
            <select id="gender" name="gender" defaultValue={v.gender}>
              <option value="">Not specified</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="dob">Date of birth</label>
            <input id="dob" name="dob" type="date" max={today} defaultValue={v.dob} />
          </div>
          <div>
            <label htmlFor="joining_date">Joining date</label>
            <input id="joining_date" name="joining_date" type="date" defaultValue={v.joining_date} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Contact</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" defaultValue={v.phone} />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue={v.email} />
          </div>
          <div>
            <label htmlFor="emergency_name">Emergency contact name</label>
            <input id="emergency_name" name="emergency_name" defaultValue={v.emergency_name} />
          </div>
          <div>
            <label htmlFor="emergency_phone">Emergency contact phone</label>
            <input id="emergency_phone" name="emergency_phone" type="tel" defaultValue={v.emergency_phone} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="address">Address</label>
            <textarea id="address" name="address" rows={2} defaultValue={v.address} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>School role</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="class_teacher_of">Class teacher of</label>
            <select id="class_teacher_of" name="class_teacher_of" defaultValue={v.class_teacher_of}>
              <option value="">Not a class teacher</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id} disabled={c.taken}>{c.label}{c.taken ? " (already has a class teacher)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="profile_id">Login account</label>
            <select id="profile_id" name="profile_id" defaultValue={v.profile_id}>
              <option value="">No login account</option>
              {accountOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="monthly_salary">Monthly salary (₹)</label>
            <input id="monthly_salary" name="monthly_salary" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={v.monthly_salary} placeholder="e.g. 25000" />
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={v.status}>
              <option value="active">Active</option>
              <option value="left">Left the school</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} defaultValue={v.notes} />
          </div>
        </div>
        <p className="sub" style={{ marginBottom: 0, marginTop: 12 }}>
          Create login accounts on the Users page first, then link the account here. Linking is optional.
        </p>
      </div>

      <div className="form-actions">
        <button className="btn" disabled={pending}>{pending ? "Saving..." : mode === "create" ? "Add staff member" : "Save changes"}</button>
        <Link className="btn ghost" href="/staff">Cancel</Link>
      </div>
    </form>
  );
}
