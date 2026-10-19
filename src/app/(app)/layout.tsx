import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/attendance", label: "Attendance" },
  { href: "/fees", label: "Fees" },
  { href: "/exams", label: "Exams & Report Cards" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Eins<span>ERP</span>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        <form action={logout}>
          <button className="btn ghost small" style={{ width: "100%", justifyContent: "center" }}>
            Log out
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
