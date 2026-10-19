import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, STAFF_ROLES, type Role } from "@/lib/auth";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const links: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", roles: STAFF_ROLES },
  { href: "/students", label: "Students", roles: STAFF_ROLES },
  { href: "/attendance", label: "Attendance", roles: ["admin", "teacher"] },
  { href: "/fees", label: "Fees", roles: ["admin", "accountant"] },
  { href: "/exams", label: "Exams & Report Cards", roles: ["admin", "teacher"] },
  { href: "/users", label: "Users", roles: ["admin"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const isStaff = STAFF_ROLES.includes(profile.role);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Eins<span>ERP</span>
        </div>
        <nav className="nav">
          {links
            .filter((l) => l.roles.includes(profile.role))
            .map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
        </nav>
        <div className="spacer" />
        <div style={{ padding: "0 10px 10px", fontSize: 13 }}>
          <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{profile.fullName || profile.email}</div>
          <span className="badge neutral" style={{ textTransform: "capitalize" }}>{profile.role}</span>
        </div>
        <form action={logout}>
          <button className="btn ghost small" style={{ width: "100%", justifyContent: "center" }}>
            Log out
          </button>
        </form>
      </aside>
      <main className="main">
        {isStaff ? (
          children
        ) : (
          <div className="card" style={{ maxWidth: 520 }}>
            <h1>{profile.role === "parent" ? "Parent portal jaldi aa raha hai" : "Approval pending"}</h1>
            <p className="sub" style={{ marginBottom: 0 }}>
              {profile.role === "parent"
                ? "Parent portal abhi taiyar ho raha hai. Taiyar hote hi aapko yahin bachche ki attendance, fees aur result dikhenge."
                : "Aapka account ban gaya hai, par abhi koi role assign nahi hua. School admin se role approve karwayein, phir dobara login karein."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
