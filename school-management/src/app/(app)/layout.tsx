import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, STAFF_ROLES, type Role } from "@/lib/auth";
import NavLinks, { type NavItem } from "@/components/NavLinks";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const links: (NavItem & { roles: Role[] })[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", roles: STAFF_ROLES },
  { href: "/students", label: "Students", icon: "students", roles: STAFF_ROLES },
  { href: "/attendance", label: "Attendance", icon: "attendance", roles: ["admin", "teacher"] },
  { href: "/fees", label: "Fees", icon: "fees", roles: ["admin", "accountant"] },
  { href: "/exams", label: "Exams", icon: "exams", roles: ["admin", "teacher"] },
  { href: "/users", label: "Users", icon: "users", roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["admin"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const isStaff = STAFF_ROLES.includes(profile.role);
  const items = links.filter((l) => l.roles.includes(profile.role));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="EinsERP" width={148} height={26} />
        </div>
        <NavLinks items={items} />
        <div className="spacer" />
        <div className="side-user">
          <div>
            <div className="name">{profile.fullName || profile.email}</div>
            <div className="role">{profile.role}</div>
          </div>
          <form action={logout}>
            <button className="btn small">Log out</button>
          </form>
        </div>
      </aside>
      <main className="main">
        {isStaff ? (
          children
        ) : (
          <div className="card" style={{ maxWidth: 520 }}>
            <h1>{profile.role === "parent" ? "Parent portal coming soon" : "Waiting for approval"}</h1>
            <p className="sub" style={{ marginBottom: 0 }}>
              {profile.role === "parent"
                ? "The parent portal is being built. Soon you will be able to see your child's attendance, fees and results here."
                : "Your account has been created, but no role has been assigned yet. Ask the school admin to approve your account, then log in again."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
