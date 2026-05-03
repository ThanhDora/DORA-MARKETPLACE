import { notFound } from "next/navigation";
import { OrderReceiptClient } from "@/components/OrderReceiptClient";

type OrderPaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderSuccessRoute({ params }: OrderPaymentPageProps) {
  const { id } = await params;
  const orderId = Number(id);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    notFound();
  }

  return <OrderReceiptClient orderId={orderId} />;
}
