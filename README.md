# EinsERP

Next.js 15 (App Router) + Supabase (Postgres + Auth) + Vercel.

**Modules (v1):** Students, Attendance, Fees (ledger, payments, receipts), Exams, Marks, Report Cards.

## 1. Supabase setup

1. [supabase.com](https://supabase.com) par naya project banayein.
2. **SQL Editor** mein `supabase/schema.sql` ka poora content paste karke Run karein.
3. **Authentication → Users → Add user** se apna staff/admin account banayein (email + password).
   Login page sirf isi tarah ke users ko andar aane deta hai; public signup nahi hai.
4. **Project Settings → API** se `Project URL` aur `anon public` key copy karein.

## 2. Local run

```bash
cp .env.example .env.local   # phir Supabase URL aur anon key bharein
npm install
npm run dev                  # http://localhost:3000
```

## 3. GitHub par push

```bash
git init && git add . && git commit -m "Initial school management system"
git branch -M main
git remote add origin https://github.com/<your-username>/einserp.git
git push -u origin main
```

## 4. Vercel deploy

1. [vercel.com/new](https://vercel.com/new) par GitHub repo import karein.
2. **Environment Variables** mein `NEXT_PUBLIC_SUPABASE_URL` aur `NEXT_PUBLIC_SUPABASE_ANON_KEY` daalein.
3. Deploy. Har `git push` par auto-deploy hoga.

## Security note

v1 mein RLS policy ye hai ki **koi bhi logged-in user poora data dekh/badal sakta hai**. Isliye Supabase mein
sirf wahi accounts banayein jinhe full access dena hai. Parent/teacher login jodne se pehle `profiles` table
aur role-based policies (admin / teacher / parent) add karni hongi.

## Aage ke modules

Timetable, teacher/staff aur salary, parent portal, SMS/WhatsApp fee reminders, notices.

## Roles (migration 002)

`supabase/002_roles.sql` ko SQL Editor mein run karein. Roles: `admin`, `accountant`, `teacher`, `parent`.
Admins create users from the **Users** page (name, email, password, role); no Supabase dashboard needed.
This requires the server-only env var `SUPABASE_SERVICE_ROLE_KEY` (Supabase -> Project Settings -> API -> `service_role`).
Add it in Vercel (Settings -> Environment Variables) and in `.env.local`, and never commit it.

## Fee structure (migration 003)

`supabase/003_fee_structure.sql` ko SQL Editor mein run karein (002 ke baad).
Fees → **Fee structure** se class-wise fee items set karein aur ek click mein poori class par generate karein.
Fees → **Defaulters** se baaki fees ki list aur CSV download milti hai.

## UI

Font: Geist (bundled through the `geist` npm package, no external font request). All interface text is English.

## Settings, invoices and UPI QR (migration 004)

Run `supabase/004_settings_invoices.sql` in the SQL Editor (after 002 and 003). It adds the `school_settings` table and a running invoice number on every fee.
Then open **Settings** (admin only) and enter the school details and UPI ID. Fee invoices (**Fees -> Invoice**) show a QR code for the balance due.
The app cannot see when a UPI payment arrives. After confirming the money in your bank or UPI app, record the payment on the Fees page.

## Admission form, photo and ID proof (migration 005)

Run `supabase/005_admission_files.sql` in the SQL Editor (after 002). It adds the extra student fields (father, mother, email,
alternate phone, blood group, previous school, admission date, ID proof type and number) and a private storage bucket
`student-files` (5 MB per file, images and PDF). Admins can see everything; accountants and teachers can only see photos, never ID proofs.
Use **Students -> New admission**. After saving, the printable admission form opens with signature lines for the student and the parent or guardian.

## School logo and ID cards (migration 006)

Run `supabase/006_logo_idcards.sql` in the SQL Editor (after 004 and 005). It adds the logo and academic session fields to `school_settings`
and a public `school-assets` bucket for the logo (admin-only upload, 1 MB limit).
- **Settings -> School logo:** upload or replace the logo; it appears on invoices, admission forms and ID cards. A transparent PNG works best.
- **Settings -> Academic session** (for example `2026-27`) is printed on ID cards as the validity.
- **Students -> ID cards:** pick a class (or use the ID card button on a student) to print 54 x 86 mm cards, nine per A4 sheet, front and back.
  For two-sided printing choose double-sided printing that flips on the long edge, so the backs line up with the fronts.
