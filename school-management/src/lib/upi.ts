import QRCode from "qrcode";

/** Basic UPI ID (VPA) shape: name@handle. The UPI app does the real validation when scanned. */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;

type UpiLinkInput = {
  vpa: string;
  name?: string | null;
  amount?: number | null;
  note?: string | null;
};

/** Builds a upi://pay link that opens a UPI app with the payee, amount and note filled in. */
export function buildUpiLink({ vpa, name, amount, note }: UpiLinkInput): string {
  const enc = encodeURIComponent;
  let link = `upi://pay?pa=${vpa}`;
  if (name) link += `&pn=${enc(name)}`;
  if (amount && amount > 0) link += `&am=${amount.toFixed(2)}`;
  link += "&cu=INR";
  if (note) link += `&tn=${enc(note.slice(0, 50))}`;
  return link;
}

/** Renders the link as a PNG data URL so it can be used in a plain <img>. */
export async function upiQrDataUrl(link: string): Promise<string> {
  return QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 1, width: 320 });
}
