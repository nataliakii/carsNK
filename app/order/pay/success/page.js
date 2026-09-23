import { readRentalPaymentStatus } from "@/domain/orders/readRentalPaymentStatus";
import PaymentStatusClient from "./PaymentStatusClient";

export const dynamic = "force-dynamic";

export default async function OrderPaySuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id || "";
  const status = await readRentalPaymentStatus(sessionId);

  return (
    <PaymentStatusClient
      initialPhase={status.phase}
      orderNumber={status.order?.orderNumber || ""}
    />
  );
}
