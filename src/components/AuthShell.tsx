import Icon from "@/components/Icon";

/** The two-column frame shared by the login, forgot-password and reset-password pages. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
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
      <div className="login-panel">{children}</div>
    </div>
  );
}
