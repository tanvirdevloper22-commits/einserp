import { redirect } from "next/navigation";

// Receipts and invoices are now one page: the invoice lists every payment received.
export default async function ReceiptsRedirect({ params }: { params: Promise<{ feeId: string }> }) {
  const { feeId } = await params;
  redirect(`/fees/invoice/${feeId}`);
}
