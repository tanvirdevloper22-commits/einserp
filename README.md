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

Automatic (API based) fee reminders. (Timetable, parent portal, notices, staff, attendance, payroll and one-tap WhatsApp/SMS fee reminders are done.)

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

## Notices (migration 011)

Run `supabase/011_notices.sql` in the SQL Editor (after 002 and 008). **Notices** in the sidebar lets admins post to everyone, staff only, all parents or one class (optionally pinned, with an expiry date).
Teachers can post to their classes or to staff and delete only their own notices. Parents see notices for everyone, for parents, and for their children's classes. Latest notices also show on the dashboard and the parent portal.

## Staff (migration 012)

Run `supabase/012_staff.sql` in the SQL Editor (after 002). **Staff** in the sidebar (admin only) keeps a record for every teacher and employee:
employee number, designation, subjects, contact and emergency details, joining date and status. A staff member can be linked to a login account
(create the account on the Users page first) and set as class teacher of one class. Use **Mark left** instead of deleting when someone leaves.

## Staff attendance (migration 013)

Run `supabase/013_staff_attendance.sql` in the SQL Editor (after 012). **Staff -> Attendance** (admin only) marks each active staff member present, late, half day, absent or on leave for a date, with an optional note.
**Monthly report** shows the counts per person and "days worked" (present and late = 1, half day = 0.5), ready to feed the salary module.

## Payroll (migration 014)

Run `supabase/014_payroll.sql` in the SQL Editor (after 012 and 013). Set each person's **Monthly salary** on the Staff page, mark their attendance, then open **Payroll** (admin only) and choose **Generate payslips** for the month.
Pay is salary x payable days / days in the month. Each absent day is unpaid, a half day loses half a day, and leave is paid up to the "paid leave days per person" you enter, then unpaid.
Late arrivals and unmarked days (Sundays, holidays) are paid in full. Type allowances and deductions into a draft, then **Mark paid** (with payment mode) and print the **Slip**.
Amounts are copied into the payslip, so changing a salary later never changes a month that is already paid. Refreshing a month keeps typed allowances and deductions and never touches paid payslips.

## Fee reminders

No migration needed. On **Fees -> Defaulters** each row has **WhatsApp** and **SMS** buttons. They open WhatsApp or the messaging app with a ready-written reminder
(school name, student, balance, amount past the due date and your UPI ID from Settings); you press send yourself. Indian numbers are accepted with or without 0, 91 or +91.
Rows with a missing or invalid guardian phone number show a note instead. Fully automatic sending would need a WhatsApp Business API or SMS provider account.

## Certificates (migration 015)

Run `supabase/015_certificates.sql` in the SQL Editor (after 002). **Certificates** (admin only) issues numbered **Transfer Certificates (TC-0001...)**, **Bonafide** and **Character** certificates.
Start from the Students list (**Certificate** button) or Certificates -> Issue a certificate. A TC asks for the date of and reason for leaving and the conduct, warns if fees are unpaid
(an admin can still override), and can mark the student as left. The student's details are copied onto the certificate when it is issued, so editing the student later never changes it.
Each certificate opens as a printable page in your chosen document template.

## Fee concessions and late fine (migration 016)

Run `supabase/016_fee_concessions.sql` in the SQL Editor (after 003 and 004). **Fees -> Concessions** lets an admin give a student a **sibling discount, scholarship, RTE free seat, staff-child** or other concession:
a percentage off, a fixed amount off, or fully waived, optionally only for fees whose title starts with some text (for example "Tuition"). The page also lists **possible siblings** (active students sharing a guardian phone number).
A concession is applied when fees are generated (Fee structure) or added (Fees page); the invoice then shows the original amount and the concession. Fees that already exist are not changed. Several concessions on one student are added together, never more than the fee.
**Late fine:** set a flat fine and grace days, then **Apply late fines now** adds one "Late fine - <fee>" for each unpaid fee that is past its due date plus the grace days. A fee is fined only once and fines are never fined again.

## Year-end promotion (migration 017)

Run `supabase/017_promotions.sql` in the SQL Editor (after 002). On **Students -> Promote class** (admin only) choose a class, untick any student who should stay (for example detained students),
choose the class they move to (the next class is suggested, such as Class 5 to Class 6 in the same section) or **Passed out**, and optionally type the new academic session. Passed-out students are marked as having left, so a Transfer Certificate can still be issued.
Promote the highest class first and work downwards. A student is only moved if still active in that class, every run is saved in the history, and **Undo** puts back the students who have not moved again since.
Fees for the new session are not created automatically; generate them from Fees -> Fee structure after promoting.

## Homework

Teachers and admins post homework for a class (optional subject, details and due date) from **Homework** in the sidebar. Parents see the current homework of their child's class on the parent portal: items due soon or recently, with "Due today / tomorrow / in N days" badges. Teachers can delete their own homework; admins can delete any.

Setup: run `supabase/018_homework.sql` in the Supabase SQL Editor.

## QR attendance

Every student ID card now carries a QR code on the back (Students → ID cards). Open **Attendance → Scan QR codes**, start the phone or laptop camera, and hold a card in front of it: the student is marked present for today (or late, if you pick that), with a beep and the name on screen. A USB barcode/QR scanner also works: click the code box and scan. Students already marked present stay as they are, a student on leave is left alone, and an absent mark is corrected to present. When the class has been scanned, **Mark rest absent** marks everyone with no record as absent without touching saved records.

The QR holds the student's id (`EINS:<id>`), so reprinting a card never changes it. The camera needs the site to be opened over https (Vercel does this) and the browser's camera permission.

### Attender (gate) account

Create a user with the role **attender** (Users → Add a user). After logging in, the attender sees only the scan page, with live numbers on top: total students, present, absent (not scanned yet) and the attendance percentage, plus a class-by-class table. Admins and teachers see the same numbers on the scan page. The attender cannot open any other page or table: scanning and the numbers go through two database functions that return only the student's name and class.

Setup: run `supabase/019_attender.sql` in the Supabase SQL Editor (it adds the role and the two functions).

### Scanner page and numbers page

**Attendance → Scan QR codes** is a dedicated scanner screen made to be left on a phone or tablet by the gate or classroom door, so students can scan their own card: a large camera view with a frame, a big green/blue/red result card with the student's name and class, a beep, and a short list of the latest scans. Use **Back camera / Front camera** to switch cameras, **Full screen** to hide everything else, and **Mark as Present/Late** to choose what a scan records. The screen stays awake while the camera is on, the camera choice is remembered, and the scanner restarts by itself after a reload once the browser has allowed the camera.

**Attendance → Today's numbers** is the separate statistics page: a percentage ring, total, present, absent and a class-by-class table with bars. It refreshes every 20 seconds. Admins and teachers also get **Mark rest absent** there. The attender account sees only these two pages.

Because the scanner is meant for students to use themselves, a student could scan a friend's card. Keep an adult nearby, or use the page only at the gate.

## Absent alerts

**Attendance → Absent alerts** lists the students marked absent on a date (today by default, filterable by class) with the guardian's name and phone number. **WhatsApp** and **SMS** open the app on your phone or computer with a ready-written message for that parent; you press send yourself, so nothing goes out automatically and no WhatsApp or SMS account is needed. Each press is remembered ("WhatsApp 09:42 by Asha Singh"), so two teachers do not message the same parent twice. If you use QR scanning, press **Mark rest absent** on Today's numbers first, because students with no record are not listed.

Admins can edit the message under the list. `{student}`, `{guardian}`, `{class}`, `{date}` and `{school}` are filled in per student; empty means the default text. Phone numbers are read as Indian numbers (10 digits, or with 0, 91 or +91); students without a usable number show "Add a phone number".

Setup: run `supabase/020_absence_alerts.sql` in the Supabase SQL Editor. The page works without it, but the message text cannot be saved and alerts are not remembered.

## Exam date sheet and admit cards

On **Exams**, each exam now has **Date sheet** and **Admit cards**.

- **Date sheet** (admin): add one paper at a time (subject, date, optional start and end time) and tick every class that writes it that day. Adding a subject that is already on a class's sheet updates it. Admins can also set the instructions printed on the cards, one per line; empty uses a standard list.
- **Admit cards** (admin, teacher): choose a class and print the cards, two to an A4 page, with the school logo and name, exam name and session, student photo, name, class, admission number, date of birth, guardian, the class's date sheet, instructions and signature lines for the class teacher and principal. Students without a photo show their initials. Cards print without paper dates if no date sheet exists yet, and a notice says so.
- **Parents** see an "Exam admit cards" row on the portal and can open and print their own child's card.

Setup: run `supabase/021_exam_schedule.sql` in the Supabase SQL Editor.

## Leave applications

**Leave** in the sidebar, for parents, teachers and admins.

- **Parents** apply for leave for their own child (first and last day, reason; the first day can be up to 14 days back). They see the status of every application (Waiting, Approved, Rejected, with the decision note) and can withdraw one that is still waiting.
- **Admins and teachers** see the waiting applications and press **Approve** or **Reject** with an optional note. Approving marks "leave" in the student's attendance for each day of the range, except Sundays. Days already marked present or late are left alone.
- **Teachers** with a linked staff record (Staff page) can also apply for their own leave. Only an admin decides staff leave; approving marks "leave" on the staff attendance, which payroll already counts against the paid-leave allowance. Sundays are skipped so a Sunday never uses up paid leave.
- **Admins** can **Record staff leave** directly; it is approved immediately.

A request can be decided only once; rejecting does not change attendance. Approved leave cannot be undone from this page yet (change the day on the attendance page instead).

Setup: run `supabase/022_leave.sql` in the Supabase SQL Editor (after the staff and staff attendance migrations).
