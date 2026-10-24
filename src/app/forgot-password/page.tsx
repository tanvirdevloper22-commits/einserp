import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";

export const metadata = { title: "Forgot password" };

async function requestReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) redirect("/forgot-password?error=" + encodeURIComponent("Enter the email address you log in with."));

  // The link in the email must come back to this site. NEXT_PUBLIC_SITE_URL wins when set; otherwise use the address in use now.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Same answer whether or not the email exists, so this page cannot be used to find out who has an account.
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    redirect("/forgot-password?error=" + encodeURIComponent("Too many requests. Please wait a few minutes and try again."));
  }
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  return (
    <AuthShell>
      <form action={requestReset} className="login-card">
        <img className="login-logo" src="/logo.png" alt="EinsERP" width={193} height={34} />
        <h1>Forgot password</h1>
        <p className="sub">Enter your email and we will send you a link to choose a new password.</p>
        {error && <div className="error">{error}</div>}
        {sent && (
          <div className="notice ok">
            If an account exists for that email, a reset link is on its way. Open it in this same browser. Check the spam folder too.
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@school.com" />
        </div>
        <button className="btn" style={{ width: "100%", padding: "10px 14px" }}>Send reset link</button>
        <p className="cell-sub" style={{ marginTop: 16, textAlign: "center" }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>Back to log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
