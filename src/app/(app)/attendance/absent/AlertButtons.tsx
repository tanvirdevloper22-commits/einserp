"use client";

import { useTransition } from "react";
import { recordAlert } from "./actions";

/** WhatsApp and SMS links for one parent. Pressing one opens the app with the message ready and notes that the parent was alerted. */
export default function AlertButtons({
  studentId,
  date,
  whatsapp,
  sms,
}: {
  studentId: string;
  date: string;
  whatsapp: string;
  sms: string;
}) {
  const [pending, start] = useTransition();
  const note = (channel: "whatsapp" | "sms") => start(async () => { await recordAlert(studentId, date, channel); });
  return (
    <div className="row tight" style={{ justifyContent: "flex-end" }}>
      <a className="btn small" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => note("whatsapp")} aria-disabled={pending}>WhatsApp</a>
      <a className="btn ghost small" href={sms} onClick={() => note("sms")} aria-disabled={pending}>SMS</a>
    </div>
  );
}
