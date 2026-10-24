import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/PasswordInput";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password" };

const MIN_PASSWORD = 8;

async function setPassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (m: string) => redirect("/reset-password?error=" + encodeURIComponent(m));

  if (password.length < MIN_PASSWORD) back(`The password must be at least ${MIN_PASSWORD} characters.`);
  if (password !== confirm) back("The two passwords do not match.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back(error.message);

  // Sign out so the new password is used straight away.
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect("/forgot-password?error=" + encodeURIComponent("Open the reset link from your email first, or request a new one."));
  }

  return (
    <AuthShell>
      <form action={setPassword} className="login-card">
        <img className="login-logo" src="/logo.png" alt="EinsERP" width={193} height={34} />
        <h1>Choose a new password</h1>
        <p className="sub">At least {MIN_PASSWORD} characters.</p>
        {error && <div className="error">{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password">New password</label>
          <PasswordInput id="password" name="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" name="confirm" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        </div>
        <button className="btn" style={{ width: "100%", padding: "10px 14px" }}>Save password</button>
      </form>
    </AuthShell>
  );
}
