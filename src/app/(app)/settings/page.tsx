import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { UPI_ID_PATTERN, buildUpiLink, upiQrDataUrl } from "@/lib/upi";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

function fail(message: string): never {
  return redirect(`/settings?error=${encodeURIComponent(message)}`);
}

async function saveSettings(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const text = (k: string) => String(formData.get(k) ?? "").trim();

  const schoolName = text("school_name");
  const upiId = text("upi_id");
  if (!schoolName) fail("Enter the school name.");
  if (upiId && !UPI_ID_PATTERN.test(upiId)) fail("That UPI ID does not look right. It should look like name@bank.");
  if (upiId && !text("upi_name")) fail("Enter the payee name that should appear in the UPI app.");

  const supabase = await createClient();
  const { error } = await supabase.from("school_settings").upsert({
    id: 1,
    school_name: schoolName,
    address: text("address") || null,
    phone: text("phone") || null,
    email: text("email") || null,
    upi_id: upiId || null,
    upi_name: text("upi_name") || null,
    invoice_note: text("invoice_note") || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    fail(
      error.message.includes("school_settings")
        ? "The settings table is missing. Run supabase/004_settings_invoices.sql in the Supabase SQL Editor first."
        : error.message
    );
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const s = await getSettings();

  const previewLink = s.upi_id ? buildUpiLink({ vpa: s.upi_id, name: s.upi_name, note: "Test" }) : null;
  const previewQr = previewLink ? await upiQrDataUrl(previewLink) : null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="School details and the UPI account that fee invoices use for the payment QR code."
      />

      {sp.error && <div className="error">{sp.error}</div>}
      {sp.saved && <div className="notice ok">Settings saved. New invoices will use these details.</div>}

      <form action={saveSettings} className="stack">
        <div className="card">
          <h2>School details</h2>
          <p className="sub" style={{ marginTop: -6 }}>Shown at the top of every invoice.</p>
          <div className="form-grid">
            <div><label htmlFor="school_name">School name</label><input id="school_name" name="school_name" defaultValue={s.school_name} required /></div>
            <div><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" defaultValue={s.phone} /></div>
            <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={s.email} /></div>
            <div><label htmlFor="address">Address</label><input id="address" name="address" defaultValue={s.address} /></div>
          </div>
        </div>

        <div className="card">
          <h2>UPI payments</h2>
          <p className="sub" style={{ marginTop: -6 }}>
            Invoices with a balance show a QR code for this UPI ID. The amount and invoice number are filled in automatically.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" }}>
            <div className="form-grid one">
              <div>
                <label htmlFor="upi_id">UPI ID</label>
                <input id="upi_id" name="upi_id" defaultValue={s.upi_id} placeholder="schoolname@okaxis" autoComplete="off" />
              </div>
              <div>
                <label htmlFor="upi_name">Payee name</label>
                <input id="upi_name" name="upi_name" defaultValue={s.upi_name} placeholder="Name on the bank account" />
                <span className="cell-sub" style={{ marginTop: 4 }}>This is the name parents see before they pay. Use the account holder&apos;s name.</span>
              </div>
              <div>
                <label htmlFor="invoice_note">Invoice footer note</label>
                <input id="invoice_note" name="invoice_note" defaultValue={s.invoice_note} placeholder="Please pay by the due date." />
              </div>
            </div>
            {previewQr && (
              <div style={{ textAlign: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewQr} alt="UPI QR preview" width={160} height={160} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
                <span className="cell-sub" style={{ maxWidth: 170, marginTop: 6 }}>
                  Scan with a UPI app to check it shows the right payee. Do not complete the payment.
                </span>
              </div>
            )}
          </div>
          <div className="notice info" style={{ margin: "16px 0 0" }}>
            The QR code makes paying easy, but this app cannot see when a payment arrives. After you confirm the money in
            your bank or UPI app, record it on the Fees page.
          </div>
        </div>

        <div><button className="btn">Save settings</button></div>
      </form>
    </>
  );
}
