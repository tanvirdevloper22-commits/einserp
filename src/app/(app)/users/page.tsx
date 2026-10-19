import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLES = ["pending", "admin", "accountant", "teacher", "parent"] as const;

async function updateUser(formData: FormData) {
  "use server";
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ROLES.includes(role as (typeof ROLES)[number])) return;
  // Admin apna khud ka role nahi badal sakta (warna lock-out ho sakta hai)
  if (id === me.id) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ role, full_name: String(formData.get("full_name") ?? "").trim() })
    .eq("id", id);
  revalidatePath("/users");
}

export default async function UsersPage() {
  const me = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  const pendingCount = (users ?? []).filter((u) => u.role === "pending").length;

  return (
    <>
      <h1>Users</h1>
      <p className="sub">
        Naya user Supabase Dashboard → Authentication → Users se banayein. Wo yahan &quot;pending&quot; dikhega, phir role assign karein.
        {pendingCount > 0 && <> <span className="badge warn">{pendingCount} approval pending</span></>}
      </p>

      <div className="card">
        <table>
          <thead>
            <tr><th>Email</th><th>Name</th><th>Role</th><th /></tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const isMe = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td>{u.email}{isMe && <span className="badge neutral" style={{ marginLeft: 8 }}>you</span>}</td>
                  <td colSpan={3}>
                    <form action={updateUser} className="row" style={{ gap: 8 }}>
                      <input type="hidden" name="id" value={u.id} />
                      <input name="full_name" defaultValue={u.full_name ?? ""} placeholder="Full name" style={{ width: 200 }} />
                      <select name="role" defaultValue={u.role} disabled={isMe} style={{ width: 140, textTransform: "capitalize" }}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn small" disabled={isMe}>Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!users?.length && <div className="empty">Koi user nahi mila.</div>}
      </div>
    </>
  );
}
