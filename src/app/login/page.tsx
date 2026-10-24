import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export const metadata = { title: "Log in" };

async function login(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;
  return (
    <AuthShell>
      <form action={login} className="login-card">
        <img className="login-logo" src="/logo.png" alt="EinsERP" width={193} height={34} />
        <h1>Log in</h1>
        <p className="sub">Use the email and password your school admin gave you.</p>
        {error && <div className="error">{error}</div>}
        {reset && <div className="notice ok">Password changed. Log in with your new password.</div>}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@school.com" />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <div style={{ marginBottom: 20, textAlign: "right" }}>
          <Link href="/forgot-password" className="cell-sub" style={{ display: "inline", textDecoration: "underline" }}>Forgot password?</Link>
        </div>
        <button className="btn" style={{ width: "100%", padding: "10px 14px" }}>Log in</button>
      </form>
    </AuthShell>
  );
}
