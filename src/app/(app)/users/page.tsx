import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

const ROLES = ["pending", "admin", "accountant", "teacher", "parent"] as const;

async function updateUser(formData: FormData) {
  "use server";
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ROLES.includes(role as (typeof ROLES)[number])) return;
  // An admin cannot change their own role, which prevents locking everyone out.
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
      <PageHeader
        title="Users"
        description="Create accounts in Supabase under Authentication, then assign each person a role here."
      >
        {pendingCount > 0 && <span className="badge warn">{pendingCount} waiting for a role</span>}
      </PageHeader>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Email</th><th>Name</th><th>Role</th><th /></tr>
            </thead>
            <tbody>
              {users?.map((u) => {
                const isMe = u.id === me.id;
                const formId = `user-${u.id}`;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="strong">{u.email}</span>
                      {isMe && <span className="badge accent" style={{ marginLeft: 8 }}>You</span>}
                    </td>
                    <td>
                      <input form={formId} name="full_name" defaultValue={u.full_name ?? ""} placeholder="Full name" aria-label="Full name" style={{ maxWidth: 240 }} />
                    </td>
                    <td>
                      <select form={formId} name="role" defaultValue={u.role} disabled={isMe} aria-label="Role" style={{ maxWidth: 160, textTransform: "capitalize" }}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="num">
                      <form id={formId} action={updateUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn small" disabled={isMe}>Save</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!users?.length && (
          <div className="empty">
            <strong>No users yet</strong>
            Accounts appear here after they are created in Supabase.
          </div>
        )}
      </div>
    </>
  );
}
