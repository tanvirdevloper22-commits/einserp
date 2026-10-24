import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

const ROLES = ["pending", "admin", "accountant", "teacher", "parent"] as const;
const ASSIGNABLE = ["admin", "accountant", "teacher", "parent"] as const;
const MIN_PASSWORD = 8;

const fail = (message: string): never => redirect(`/users?error=${encodeURIComponent(message)}`);

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

async function createUser(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  if (!hasServiceRoleKey()) {
    fail("The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel under Settings, Environment Variables, then redeploy.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!email) fail("Enter an email address.");
  if (!ASSIGNABLE.includes(role as (typeof ASSIGNABLE)[number])) fail("Choose a role for the new user.");
  if (password.length < MIN_PASSWORD) fail(`The password must be at least ${MIN_PASSWORD} characters.`);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) fail(error?.message ?? "The user could not be created.");

  // A database trigger already added a "pending" profile; set the real role and name.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user!.id, email, full_name: fullName, role });
  if (profileError) fail(`The account was created, but its role could not be saved: ${profileError.message}`);

  revalidatePath("/users");
  redirect(`/users?created=${encodeURIComponent(email)}`);
}

async function resetPassword(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  if (!hasServiceRoleKey()) {
    fail("The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel under Settings, Environment Variables, then redeploy.");
  }

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id) fail("Choose a user.");
  if (password.length < MIN_PASSWORD) fail(`The password must be at least ${MIN_PASSWORD} characters.`);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) fail(error.message);

  redirect("/users?reset=1");
}

async function deleteUser(formData: FormData) {
  "use server";
  const me = await requireRole(["admin"]);
  if (!hasServiceRoleKey()) {
    fail("The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel under Settings, Environment Variables, then redeploy.");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) fail("Choose a user.");
  if (id === me.id) fail("You cannot delete your own account.");

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("email, role").eq("id", id).maybeSingle();
  if (!target) fail("That user was not found. It may already be deleted.");

  // Never remove the last admin, so the school cannot be locked out.
  if (target!.role === "admin") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) fail("This is the only admin account, so it cannot be deleted.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) fail(`The user could not be deleted: ${error.message}`);

  // The profile and any parent-child links go with the login; this only makes sure nothing is left behind.
  await admin.from("profiles").delete().eq("id", id);

  revalidatePath("/users");
  redirect(`/users?deleted=${encodeURIComponent(target!.email ?? "The user")}`);
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; reset?: string; deleted?: string }>;
}) {
  const me = await requireRole(["admin"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  const pendingCount = (users ?? []).filter((u) => u.role === "pending").length;
  const keyMissing = !hasServiceRoleKey();

  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts, assign roles, reset passwords and remove users."
      >
        {pendingCount > 0 && <span className="badge warn">{pendingCount} waiting for a role</span>}
      </PageHeader>

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.created && <div className="notice ok">Account created for {sp.created}. Share the email and password with them so they can log in.</div>}
      {sp.reset && <div className="notice ok">Password updated.</div>}
      {sp.deleted && <div className="notice ok">{sp.deleted} was deleted and can no longer log in.</div>}
      {keyMissing && (
        <div className="notice info">
          Creating users and resetting passwords needs the <strong>SUPABASE_SERVICE_ROLE_KEY</strong> environment
          variable on the server. Add it in Vercel under Settings, Environment Variables, then redeploy.
        </div>
      )}

      <div className="grid two">
        <form action={createUser} className="card">
          <h2>Add a user</h2>
          <div className="form-grid one">
            <div><label htmlFor="new_name">Full name</label><input id="new_name" name="full_name" required /></div>
            <div><label htmlFor="new_email">Email</label><input id="new_email" name="email" type="email" autoComplete="off" required /></div>
            <div>
              <label htmlFor="new_password">Password</label>
              <input id="new_password" name="password" type="text" minLength={MIN_PASSWORD} autoComplete="off" required />
              <span className="cell-sub" style={{ marginTop: 4 }}>At least {MIN_PASSWORD} characters. Share it with the user directly.</span>
            </div>
            <div>
              <label htmlFor="new_role">Role</label>
              <select id="new_role" name="role" defaultValue="" required style={{ textTransform: "capitalize" }}>
                <option value="" disabled>Select a role</option>
                {ASSIGNABLE.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions"><button className="btn" disabled={keyMissing}>Create user</button></div>
        </form>

        <form action={resetPassword} className="card">
          <h2>Reset a password</h2>
          <div className="form-grid one">
            <div>
              <label htmlFor="reset_user">User</label>
              <select id="reset_user" name="id" defaultValue="" required>
                <option value="" disabled>Select a user</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ? `${u.full_name} (${u.email})` : u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reset_password">New password</label>
              <input id="reset_password" name="password" type="text" minLength={MIN_PASSWORD} autoComplete="off" required />
              <span className="cell-sub" style={{ marginTop: 4 }}>At least {MIN_PASSWORD} characters.</span>
            </div>
          </div>
          <div className="form-actions"><button className="btn ghost" disabled={keyMissing}>Update password</button></div>
        </form>
      </div>

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
                      {u.role === "parent" && <Link className="btn ghost small" href={`/users/${u.id}/children`} style={{ marginRight: 8 }}>Children</Link>}
                      <form id={formId} action={updateUser} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn small" disabled={isMe}>Save</button>
                      </form>
                      <form action={deleteUser} style={{ display: "inline", marginLeft: 8 }}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmButton
                          className="btn danger small"
                          disabled={isMe || keyMissing}
                          message={`Delete ${u.email}? They will no longer be able to log in. This cannot be undone.`}
                        >
                          Delete
                        </ConfirmButton>
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
            Add the first user using the form above.
          </div>
        )}
      </div>
    </>
  );
}
