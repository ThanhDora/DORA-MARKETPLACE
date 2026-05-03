"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Minus, Plus, RotateCw, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatCurrency,
  isNumericId,
  statusLabel,
  type ApiEnvelope,
  type Order,
  type StoreProduct,
  type WalletData,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";

type CheckoutLineItem = {
  product: StoreProduct;
  quantity: number;
};

type CheckoutClientProps = {
  items: CheckoutLineItem[];
};

type PaymentResponse = {
  orderId?: number;
  status?: string;
};

function clampQuantity(quantity: number, stock: number) {
  return Math.min(Math.max(quantity, 1), Math.max(stock, 1));
}

function serializeCheckoutItems(items: CheckoutLineItem[]) {
  return items.map((item) => `${item.product.id}:${item.quantity}`).join(",");
}

export function CheckoutClient({ items }: CheckoutClientProps) {
  const router = useRouter();
  const { isAuthenticated, isInitializing, user, apiFetch } = useAuth();
  const { orderUpdates, stockUpdates } = useRealtime();
  const { showToast } = useToast();
  const [lineItems, setLineItems] = useState<CheckoutLineItem[]>(
    items.map((item) => ({
      product: item.product,
      quantity: clampQuantity(item.quantity, item.product.stock),
    })),
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    setLineItems(
      items.map((item) => ({
        product: item.product,
        quantity: clampQuantity(item.quantity, item.product.stock),
      })),
    );
  }, [items]);

  useEffect(() => {
    setLineItems((current) => {
      let changed = false;
      const next = current.map((line) => {
        const realtimeStock = stockUpdates[line.product.id];
        if (typeof realtimeStock !== "number") {
          return line;
        }
        const normalizedStock = Math.max(0, realtimeStock);
        const nextQuantity = clampQuantity(line.quantity, normalizedStock);
        if (normalizedStock === line.product.stock && nextQuantity === line.quantity) {
          return line;
        }
        changed = true;
        return {
          ...line,
          product: {
            ...line.product,
            stock: normalizedStock,
          },
          quantity: nextQuantity,
        };
      });
      return changed ? next : current;
    });
  }, [stockUpdates]);

  const liveStatus = order ? orderUpdates[order.id] ?? order.status : null;
  const activeStep = liveStatus === "PAID" || liveStatus === "DELIVERED" ? 3 : 2;
  const stepProgress = ((activeStep - 1) / 2) * 100;
  const totalQuantity = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity, 0),
    [lineItems],
  );
  const totalAmount = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [lineItems],
  );
  const checkoutPath = useMemo(() => {
    const encodedItems = serializeCheckoutItems(lineItems);
    return encodedItems ? `/checkout?items=${encodeURIComponent(encodedItems)}` : "/checkout";
  }, [lineItems]);
  const backHref = lineItems.length > 1 ? "/cart" : `/products/${lineItems[0]?.product.id ?? ""}`;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    apiFetch<ApiEnvelope<WalletData>>("/wallet", { notifySuccess: false })
      .then((res) => setWalletBalance(res.data.balance))
      .catch(() => {});
  }, [apiFetch, isAuthenticated]);

  useEffect(() => {
    if (!order) {
      return;
    }
    const timer = window.setInterval(() => {
      apiFetch<ApiEnvelope<Order>>(`/orders/${order.id}`)
        .then((response) => setOrder(response.data))
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [apiFetch, order]);

  function updateQuantity(index: number, nextQuantity: number) {
    setLineItems((current) =>
      current.map((line, currentIndex) =>
        currentIndex === index
          ? {
              ...line,
              quantity: clampQuantity(nextQuantity, line.product.stock),
            }
          : line,
      ),
    );
  }

  async function submitOrder() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    if (lineItems.length === 0) {
      showToast("Không có sản phẩm để thanh toán.");
      return;
    }
    if (lineItems.some((item) => !isNumericId(item.product.id))) {
      showToast("Sản phẩm demo không thể thanh toán khi backend chưa có dữ liệu.");
      return;
    }
    if (walletBalance !== null && walletBalance < totalAmount) {
      showToast("Số dư ví không đủ. Vui lòng nạp thêm.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderResponse = await apiFetch<ApiEnvelope<Order>>("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: lineItems.map((item) => ({
            productId: Number(item.product.id),
            quantity: item.quantity,
          })),
          paymentMethod: "PLATFORM",
        }),
      });
      setOrder(orderResponse.data);

      const paymentResponse = await apiFetch<ApiEnvelope<PaymentResponse>>("/payments/create", {
        method: "POST",
        body: JSON.stringify({ orderId: String(orderResponse.data.id), method: "PLATFORM" }),
      });

      if (paymentResponse.data.status === "PAID") {
        router.push(`/order/${orderResponse.data.id}/success`);
        return;
      }

      showToast(paymentResponse.message ?? "Đơn hàng đang chờ xác nhận thanh toán.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tạo đơn hàng.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isInitializing) {
    return (
      <section className="grid md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] gap-grid-gap items-start px-inline py-[clamp(48px,6vw,76px)]">
        <div className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] p-[clamp(20px,2.6vw,28px)] skeleton-panel" />
        <aside className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] p-[clamp(20px,2.6vw,28px)] sticky top-[calc(var(--header-height)+22px)] skeleton-panel" />
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
        <LockKeyhole size={34} />
        <h1>Đăng nhập để thanh toán</h1>
        <p>Thanh toán bằng ví web yêu cầu tài khoản đã đăng nhập.</p>
        <div className="flex flex-wrap gap-[14px] mt-7">
          <Link
            href={`/login?next=${encodeURIComponent(checkoutPath)}`}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface"
          >
            Tạo tài khoản
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-grid-gap items-start px-inline py-[clamp(48px,6vw,76px)] md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] checkout-layout--commerce">
      <div className="grid gap-[18px]">
        <article className="relative isolate overflow-hidden rounded-[28px] border border-card-border bg-surface p-[clamp(20px,2.8vw,30px)] shadow-soft">
          <div className="pointer-events-none absolute inset-0 opacity-90" aria-hidden="true">
            <div className="absolute -right-16 -top-20 h-[220px] w-[220px] rounded-full border border-tertiary/25 bg-[radial-gradient(circle,rgba(100,210,255,0.26),transparent_65%)]" />
            <div className="absolute bottom-0 left-0 h-[180px] w-[320px] bg-[linear-gradient(125deg,rgba(255,255,255,0.26),transparent)]" />
          </div>

          <div className="relative z-[1] grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
            <div>
              <Link href={backHref} className="mb-4 inline-flex items-center gap-2 text-[13px] font-extrabold text-secondary transition-colors hover:text-primary">
                {lineItems.length > 1 ? "Quay lại giỏ hàng" : "Quay lại sản phẩm"}
              </Link>

              <div className="hero-kicker">
                <span>Checkout ví web</span>
                <span className="hero-kicker__realtime">
                  <span className="hero-kicker__dot" />
                  Đồng bộ realtime
                </span>
              </div>

              <h1 className="mb-2 text-[clamp(28px,3.8vw,44px)] font-black leading-[1.05]">Xác nhận đơn hàng</h1>
              <p className="m-0 max-w-[60ch] text-[15px] font-semibold text-secondary">
                Kiểm tra số lượng, thanh toán bằng ví web và theo dõi trạng thái bàn giao theo thời gian thực.
              </p>

              <div className="mt-5">
                <div className="relative px-2">
                  <ol className="relative z-[2] mb-2 grid grid-cols-3 gap-2">
                    {[
                      { step: 1, label: "Giỏ hàng" },
                      { step: 2, label: "Thanh toán" },
                      { step: 3, label: "Bàn giao" },
                    ].map((item) => {
                      const isDone = activeStep > item.step;
                      const isCurrent = activeStep === item.step;
                      return (
                        <li key={item.step} className="grid justify-items-center gap-1 text-center">
                          <span
                            className={
                              isCurrent
                                ? "text-[11px] font-black uppercase tracking-wide text-primary"
                                : isDone
                                  ? "text-[11px] font-black uppercase tracking-wide text-success"
                                  : "text-[11px] font-extrabold uppercase tracking-wide text-secondary"
                            }
                          >
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="relative h-11">
                    <div className="absolute left-[16.6667%] right-[16.6667%] top-[20px] h-[5px] rounded-full bg-border/70" />
                    <div
                      className="absolute left-[16.6667%] top-[20px] h-[5px] rounded-full bg-[linear-gradient(90deg,var(--color-tertiary),var(--color-accent))] transition-all duration-medium"
                      style={{ width: `calc(66.6666% * ${stepProgress / 100})` }}
                    />
                    <div
                      className="absolute top-[2px] z-[3] h-10 w-10 -translate-x-1/2 rounded-full border border-white/65 bg-surface p-1 shadow-[0_12px_26px_rgba(0,122,255,0.22)] transition-all duration-medium"
                      style={{ left: `calc(16.6667% + 66.6666% * ${stepProgress / 100})` }}
                      aria-hidden="true"
                    >
                      <img src="/logo.jpg" alt="" className="h-full w-full rounded-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <figure className="relative hidden overflow-hidden rounded-[20px] border border-border bg-neutral p-2 md:grid md:place-items-center">
              <img src="/marketplace-console.svg" alt="Checkout visual" className="h-[188px] w-full rounded-[16px] object-cover" />
              <img src="/logo.jpg" alt="Dora logo" className="absolute right-3 top-3 h-9 w-9 rounded-full border border-white/60 object-cover shadow-[0_8px_20px_rgba(0,122,255,0.25)]" />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Wallet Checkout
              </span>
            </figure>
          </div>
        </article>

        <article className="rounded-[24px] border border-card-border bg-surface p-[clamp(18px,2.2vw,24px)] shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[18px] font-black text-primary">Sản phẩm trong đơn</h2>
            <span className="inline-flex min-h-[30px] items-center rounded-full border border-border bg-neutral px-3 text-[12px] font-extrabold text-secondary">
              {lineItems.length} mặt hàng
            </span>
          </div>

          <div className="grid gap-3.5">
            {lineItems.map((item, index) => {
              const liveStock = Math.max(0, item.product.stock);
              const remainingStock = Math.max(0, liveStock - item.quantity);
              const stockToneClass =
                remainingStock === 0
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : remainingStock <= 3
                    ? "border-warning/35 bg-warning/10 text-warning"
                    : "border-success/30 bg-success/10 text-success";

              return (
                <div key={`${item.product.id}-${index}`} className="grid gap-2.5 rounded-[16px] border border-border/90 bg-neutral p-2.5 transition-all duration-medium md:grid-cols-[78px_minmax(0,1fr)_auto] md:items-center">
                  <div className="checkout-line__visual grid h-[78px] w-[78px] place-items-center overflow-hidden rounded-[14px] border border-border bg-neutral">
                    {item.product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product.images[0]} alt={item.product.name} />
                    ) : (
                      <span>{item.product.type}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <strong className="block truncate text-[14px] font-extrabold text-primary">{item.product.name}</strong>
                    <p className="m-0 mt-0.5 line-clamp-1 text-[12px] font-semibold text-secondary">{item.product.description}</p>
                    <small className="mt-1.5 inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-extrabold text-primary">
                      {formatCurrency(item.product.price)}
                    </small>
                  </div>

                  <div className="grid justify-items-end gap-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-secondary">SL</span>
                    <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-surface p-0.5 shadow-sm">
                      <button
                        type="button"
                        className="grid h-6 w-6 place-items-center rounded-full text-primary transition-all hover:bg-neutral hover:text-tertiary disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1 || isSubmitting}
                        aria-label={`Giảm số lượng ${item.product.name}`}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="inline-grid min-w-[26px] place-items-center text-[12px] font-black text-primary" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="grid h-6 w-6 place-items-center rounded-full text-primary transition-all hover:bg-neutral hover:text-tertiary disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        disabled={item.quantity >= Math.max(liveStock, 1) || isSubmitting}
                        aria-label={`Tăng số lượng ${item.product.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-black uppercase tracking-wide ${stockToneClass}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {remainingStock === 0 ? "hết hàng" : `kho ${remainingStock}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[24px] border border-card-border bg-surface p-[clamp(18px,2.2vw,24px)] shadow-soft">
          <h2 className="m-0 mb-4 text-[18px] font-black text-primary">Thanh toán bằng ví web</h2>

          <div className={`rounded-[14px] border p-3 text-[12px] font-bold ${
            walletBalance === null
              ? "border-border bg-neutral text-secondary"
              : walletBalance >= totalAmount
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={14} />
              <span>Số dư ví: {walletBalance !== null ? formatCurrency(walletBalance) : "Đang tải..."}</span>
            </div>
            {walletBalance === null ? (
              <p className="m-0 text-[11px]">Có thể tiếp tục thanh toán, hệ thống sẽ kiểm tra số dư khi xác nhận đơn.</p>
            ) : walletBalance < totalAmount ? (
              <p className="m-0 text-[11px]">Không đủ số dư. <Link href="/account/wallet" className="underline">Nạp thêm</Link></p>
            ) : (
              <p className="m-0 text-[11px]">Đủ số dư để hoàn tất thanh toán đơn hàng.</p>
            )}
          </div>

          <button
            type="button"
            className="checkout-submit mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-tertiary bg-tertiary px-5 py-3 text-[15px] font-extrabold text-on-accent shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
            onClick={submitOrder}
            disabled={isSubmitting || (walletBalance !== null && walletBalance < totalAmount)}
          >
            {isSubmitting ? <RotateCw size={17} className="spin-icon" /> : <ShieldCheck size={17} />}
            {isSubmitting ? "Đang xử lý..." : "Thanh toán bằng ví web"}
          </button>
        </article>
      </div>

      <aside className="checkout-card sticky top-[calc(var(--header-height)+22px)] rounded-[26px] border border-card-border bg-surface p-[clamp(20px,2.4vw,28px)] shadow-soft">
        <figure className="relative mb-4 overflow-hidden rounded-[18px] border border-border bg-neutral p-2">
          <img src="/marketplace-console.svg" alt="Secure checkout" className="h-[140px] w-full rounded-[14px] object-cover" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Bảo mật</span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-tertiary/30 bg-tertiary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Ví web</span>
        </figure>

        <p className="m-0 mb-2 text-[12px] font-extrabold uppercase tracking-wide text-secondary">Tóm tắt đơn hàng</p>
        <h2 className="m-0 text-[28px] font-black leading-none text-primary">{formatCurrency(totalAmount)}</h2>
        <p className="mt-2 text-[13px] font-bold text-secondary">Người mua: {user?.name ?? "Khách hàng"}</p>

        <dl className="mt-4 grid gap-2.5">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <dt className="text-[13px] font-bold text-secondary">Số mặt hàng</dt>
            <dd className="m-0 text-[14px] font-extrabold text-primary">{lineItems.length}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <dt className="text-[13px] font-bold text-secondary">Tổng số lượng</dt>
            <dd className="m-0 text-[14px] font-extrabold text-primary">{totalQuantity}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <dt className="text-[13px] font-bold text-secondary">Phương thức</dt>
            <dd className="m-0 text-[14px] font-extrabold text-primary">Ví web</dd>
          </div>
          {order ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <dt className="text-[13px] font-bold text-secondary">Mã đơn</dt>
                <dd className="m-0 text-[14px] font-extrabold text-primary">#{order.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <dt className="text-[13px] font-bold text-secondary">Trạng thái</dt>
                <dd className="m-0 inline-flex items-center rounded-full border border-tertiary/30 bg-tertiary/12 px-2.5 py-1 text-[12px] font-black uppercase tracking-wide text-primary">
                  {statusLabel(liveStatus ?? order.status)}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        <div className="mt-4 rounded-[14px] border border-border bg-neutral p-3 text-[12px] font-semibold text-secondary">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-extrabold text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            Bảo mật phiên thanh toán
          </div>
          <p className="m-0 leading-relaxed">
            Access token chỉ giữ trong bộ nhớ. Refresh token được backend đặt bằng HttpOnly cookie để giảm rủi ro lộ phiên.
          </p>
        </div>
      </aside>
    </section>
  );
}
