import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Icon from "@/components/Icon";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="login-wrap">
      <aside className="login-aside">
        <div>
          <h2>Run your school from one place.</h2>
          <p>Admissions, daily attendance, fee collection and report cards, with the right access for every staff member.</p>
          <ul>
            <li><Icon name="check" /> Student records and class lists</li>
            <li><Icon name="check" /> Attendance in a few clicks</li>
            <li><Icon name="check" /> Fee ledger, receipts and defaulters</li>
            <li><Icon name="check" /> Marks and printable report cards</li>
          </ul>
        </div>
      </aside>

      <div className="login-panel">
        <form action={login} className="login-card">
          <img className="login-logo" src="/logo.png" alt="EinsERP" width={193} height={34} />
          <h1>Log in</h1>
          <p className="sub">Use the email and password your school admin gave you.</p>
          {error && <div className="error">{error}</div>}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="name@school.com" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn" style={{ width: "100%", padding: "10px 14px" }}>Log in</button>
        </form>
      </div>
    </div>
  );
}
