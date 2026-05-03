import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PackageCheck, ReceiptText } from "lucide-react";
import { getProductBySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Đã tạo yêu cầu mua",
};

type OrderSuccessPageProps = {
  searchParams?: Promise<{
    product?: string;
    email?: string;
  }>;
};

export default async function OrderSuccessPage({ searchParams }: OrderSuccessPageProps) {
  const params = await searchParams;
  const product = getProductBySlug(params?.product ?? "");
  const email = params?.email;

  return (
    <main className="px-inline py-[clamp(42px,6vw,76px)]">
      <section className="mx-auto grid min-h-[calc(100svh-var(--header-height)-96px)] max-w-[980px] place-items-center">
        <article className="w-full overflow-hidden rounded-[28px] border border-card-border bg-surface p-[clamp(22px,4vw,42px)] shadow-soft">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <span className="mb-4 inline-flex min-h-[34px] items-center gap-2 rounded-full border border-border bg-neutral px-3 text-[12px] font-black uppercase tracking-wide text-primary">
                <CheckCircle2 size={15} className="text-success" />
                Đã ghi nhận
              </span>
              <h1 className="m-0 max-w-[720px] text-[clamp(34px,5vw,58px)] leading-[1.02]">
                Yêu cầu mua đã sẵn sàng xử lý.
              </h1>
              <p className="mt-4 max-w-[62ch] text-[15px] font-semibold leading-7 text-secondary">
                {product
                  ? `Đơn cho ${product.title} sẽ được đối chiếu tồn kho trước khi bàn giao.`
                  : "Đơn hàng sẽ được đối chiếu tồn kho trước khi bàn giao."}
                {email ? ` Email nhận hàng: ${email}.` : ""}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] border border-tertiary bg-tertiary px-5 text-[15px] font-extrabold text-on-accent shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-[0.98]">
                  Tiếp tục mua
                  <ArrowRight size={16} />
                </Link>
                <Link href="/account/orders" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] border border-border bg-surface px-5 text-[15px] font-extrabold text-primary transition-all duration-fast hover:-translate-y-[1px] hover:border-tertiary/35">
                  Xem đơn hàng
                </Link>
              </div>
            </div>

            <aside className="rounded-[22px] border border-border bg-neutral p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="grid h-11 w-11 place-items-center rounded-[14px] border border-border bg-surface text-primary">
                  <ReceiptText size={20} />
                </div>
                <span className="rounded-full border border-success/25 bg-success/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-success">
                  Pending review
                </span>
              </div>

              <dl className="grid gap-3">
                <div className="grid gap-1">
                  <dt>Sản phẩm</dt>
                  <dd className="break-words text-[15px]">{product?.title ?? "Đơn marketplace"}</dd>
                </div>
                <div className="grid gap-1">
                  <dt>Nhận hàng</dt>
                  <dd className="break-words text-[15px]">{email ?? "Theo email tài khoản"}</dd>
                </div>
                <div className="grid gap-1 rounded-[16px] border border-border bg-surface p-3">
                  <dt>Bước tiếp theo</dt>
                  <dd className="inline-flex items-center gap-2 text-[14px]">
                    <PackageCheck size={16} />
                    Đối chiếu tồn kho
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </article>
      </section>
    </main>
  );
}
