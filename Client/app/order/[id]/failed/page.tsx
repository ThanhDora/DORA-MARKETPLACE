import Link from "next/link";
import { ShieldAlert } from "lucide-react";

type OrderPaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderFailedRoute({ params }: OrderPaymentPageProps) {
  const { id } = await params;

  return (
    <main>
      <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
        <ShieldAlert size={38} />
        <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Thanh toán thất bại</p>
        <h1>Đơn #{id} chưa thanh toán.</h1>
        <p>Bạn có thể thử lại trong tài khoản hoặc tạo đơn hàng mới.</p>
        <div className="flex flex-wrap gap-[14px] mt-7">
          <Link href="/account" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Xem tài khoản
          </Link>
          <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface">
            Quay lại marketplace
          </Link>
        </div>
      </section>
    </main>
  );
}
