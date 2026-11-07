import { db } from "@/lib/mock/data";
import { RESERVED_PAYMENT_IDS } from "@/lib/mock/commercial";
import { PaymentPendingView } from "@/components/commercial/payment-pending-view";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...db.payments.map((p) => ({ id: p.id })), ...RESERVED_PAYMENT_IDS.map((id) => ({ id }))];
}

export default async function PaymentPendingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentPendingView paymentId={id} />;
}
