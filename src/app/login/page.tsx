import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="login-wrap">
      <form action={login} className="card login-card">
        <div className="brand" style={{ padding: "0 0 4px" }}>
          Eins<span>ERP</span>
        </div>
        <p className="sub">Staff login</p>
        {error && <div className="error">{error}</div>}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn" style={{ width: "100%", justifyContent: "center" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
