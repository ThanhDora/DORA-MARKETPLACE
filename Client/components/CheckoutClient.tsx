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
      showToast("Không có sản phẩm để thanh toán.", "error");
      return;
    }
    if (lineItems.some((item) => !isNumericId(item.product.id))) {
      showToast("Sản phẩm demo không thể thanh toán khi backend chưa có dữ liệu.", "error");
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
      const message = error instanceof Error ? error.message : "Không thể tạo đơn hàng.";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isInitializing) {
    return (
      <section className="grid md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] gap-grid-gap items-start px-inline py-[clamp(48px,6vw,76px)]">
        <div className="bg-surface p-[clamp(20px,2.6vw,28px)] skeleton-panel" />
        <aside className="bg-surface p-[clamp(20px,2.6vw,28px)] sticky top-[calc(var(--header-height)+22px)] skeleton-panel" />
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
        <LockKeyhole size={34} />
        <h1>Đăng nhập để thanh toán</h1>
        <p>Thanh toán bằng ví web yêu cầu tài khoản đã đăng nhập.</p>
        <div className="flex flex-wrap gap-[14px] mt-7 justify-center">
          <Link
            href={`/login?next=${encodeURIComponent(checkoutPath)}`}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 px-6 py-3 text-[15px] font-semibold text-center"
            style={{ backgroundColor: "#141413", border: "1px solid #141413", color: "#faf9f5" }}
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[46px] items-center justify-center gap-2 px-6 py-3 text-[15px] font-semibold text-center"
            style={{ border: "1px solid #141413", color: "#141413" }}
          >
            Tạo tài khoản
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-grid-gap items-start px-inline py-[clamp(48px,6vw,76px)] md:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
      <div className="grid gap-[18px]">
        {/* ── Header card ── */}
        <article className="bg-surface p-[clamp(24px,3vw,36px)]">
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-secondary"
          >
            {lineItems.length > 1 ? "Quay lại giỏ hàng" : "Quay lại sản phẩm"}
          </Link>

          <div className="hero-kicker">
            <span>Checkout</span>
            <span className="hero-kicker__realtime">
              <span className="hero-kicker__dot" />
              Đồng bộ realtime
            </span>
          </div>

          <h1 className="mb-2 text-[clamp(28px,3.8vw,44px)] font-bold leading-[1.08]">
            Xác nhận đơn hàng
          </h1>
          <p className="m-0 max-w-[60ch] text-[15px] font-normal text-secondary">
            Kiểm tra số lượng, thanh toán bằng ví web và theo dõi trạng thái bàn giao theo thời gian
            thực.
          </p>

          {/* ── Stepper ── */}
          <div className="mt-6">
            <ol className="flex items-center justify-between mb-2">
              {[
                { step: 1, label: "Giỏ hàng" },
                { step: 2, label: "Thanh toán" },
                { step: 3, label: "Bàn giao" },
              ].map((item) => {
                const isDone = activeStep > item.step;
                const isCurrent = activeStep === item.step;
                return (
                  <li key={item.step} className="text-center">
                    <span
                      className={
                        "text-[11px] font-semibold uppercase tracking-wide " +
                        (isCurrent
                          ? "text-primary"
                          : isDone
                            ? ""
                            : "text-secondary")
                      }
                      style={isDone ? { color: "#788c5d" } : undefined}
                    >
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="relative h-[1px]" style={{ background: "#d1cfc5" }}>
              <div
                className="absolute inset-y-0 left-0 transition-all duration-[360ms]"
                style={{ width: `${stepProgress}%`, background: "#141413" }}
              />
            </div>
          </div>
        </article>

        {/* ── Line items ── */}
        <article className="bg-surface p-[clamp(18px,2.2vw,24px)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[18px] font-semibold text-primary">Sản phẩm trong đơn</h2>
            <span className="inline-flex min-h-[30px] items-center border px-3 text-[12px] font-semibold text-secondary"
              style={{ borderColor: "#d1cfc5" }}>
              {lineItems.length} mặt hàng
            </span>
          </div>

          <div className="grid gap-3.5">
            {lineItems.map((item, index) => {
              const liveStock = Math.max(0, item.product.stock);
              const remainingStock = Math.max(0, liveStock - item.quantity);
              const stockColor =
                remainingStock === 0 ? "#c46686" : remainingStock <= 3 ? "#d97757" : "#788c5d";

              return (
                <div
                  key={`${item.product.id}-${index}`}
                  className="grid gap-3 bg-neutral p-3 md:grid-cols-[78px_minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="checkout-line__visual grid h-[78px] w-[78px] place-items-center overflow-hidden bg-[#e3dacc]">
                    {item.product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold uppercase text-secondary">
                        {item.product.type}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <strong className="block truncate text-[14px] font-semibold text-primary">
                      {item.product.name}
                    </strong>
                    <p className="m-0 mt-0.5 line-clamp-2 text-[12px] font-normal text-secondary">
                      {item.product.description}
                    </p>
                    <small
                      className="mt-1.5 inline-flex border px-2 py-0.5 text-[11px] font-semibold text-primary"
                      style={{ borderColor: "#d1cfc5" }}
                    >
                      {formatCurrency(item.product.price)}
                    </small>
                  </div>

                  <div className="grid justify-items-end gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">
                      SL
                    </span>
                    <div
                      className="inline-flex items-center"
                      style={{ border: "1px solid #141413" }}
                    >
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center text-primary disabled:opacity-40"
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        disabled={item.quantity <= 1 || isSubmitting}
                        aria-label={`Giảm số lượng ${item.product.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span
                        className="inline-grid min-w-[28px] place-items-center text-[13px] font-semibold text-primary"
                        aria-live="polite"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center text-primary disabled:opacity-40"
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        disabled={item.quantity >= Math.max(liveStock, 1) || isSubmitting}
                        aria-label={`Tăng số lượng ${item.product.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide"
                      style={{ borderColor: stockColor, color: stockColor }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: stockColor }}
                      />
                      {remainingStock === 0 ? "hết hàng" : `kho ${remainingStock}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        {/* ── Payment card ── */}
        <article className="bg-surface p-[clamp(18px,2.2vw,24px)]">
          <h2 className="m-0 mb-4 text-[18px] font-semibold text-primary">
            Thanh toán bằng ví web
          </h2>

          <div
            className="p-3 text-[13px] font-semibold"
            style={{
              border: "1px solid",
              borderColor:
                walletBalance === null
                  ? "#d1cfc5"
                  : walletBalance >= totalAmount
                    ? "#788c5d"
                    : "#c46686",
              color:
                walletBalance === null
                  ? "#5e5d59"
                  : walletBalance >= totalAmount
                    ? "#788c5d"
                    : "#c46686",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={14} />
              <span>
                Số dư ví:{" "}
                {walletBalance !== null ? formatCurrency(walletBalance) : "Đang tải..."}
              </span>
            </div>
            {walletBalance === null ? (
              <p className="m-0 text-[12px] font-normal" style={{ color: "#5e5d59" }}>
                Đang kiểm tra số dư ví...
              </p>
            ) : walletBalance < totalAmount ? (
              <p className="m-0 text-[12px] font-normal" style={{ color: "#c46686" }}>
                Không đủ số dư.{" "}
                <Link href="/account/wallet" className="underline" style={{ color: "#c46686" }}>
                  Nạp thêm
                </Link>
              </p>
            ) : (
              <p className="m-0 text-[12px] font-normal" style={{ color: "#788c5d" }}>
                Đủ số dư để hoàn tất thanh toán đơn hàng.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={submitOrder}
            disabled={isSubmitting || walletBalance === null || walletBalance < totalAmount}
            className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 px-6 py-3 text-[15px] font-semibold text-center disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isSubmitting ? "#c6613f" : "#d97757",
              border: "1px solid #d97757",
              color: "#faf9f5",
            }}
          >
            {isSubmitting ? (
              <RotateCw size={17} className="spin-icon" />
            ) : (
              <ShieldCheck size={17} />
            )}
            {isSubmitting ? "Đang xử lý..." : "Xác nhận thanh toán"}
          </button>
        </article>
      </div>

      {/* ── Order summary sidebar ── */}
      <aside className="bg-surface p-[clamp(20px,2.4vw,28px)] sticky top-[calc(var(--header-height)+22px)]">
        <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-secondary">
          Tóm tắt đơn hàng
        </p>
        <h2 className="m-0 text-[28px] font-bold leading-none text-primary">
          {formatCurrency(totalAmount)}
        </h2>
        <p className="mt-2 text-[13px] font-normal text-secondary">
          Người mua: {user?.name ?? "Khách hàng"}
        </p>

        <dl className="mt-5 grid gap-3">
          <div
            className="flex items-center justify-between gap-3 pb-2"
            style={{ borderBottom: "1px solid #d1cfc5" }}
          >
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Số mặt hàng
            </dt>
            <dd className="m-0 text-[14px] font-semibold text-primary">{lineItems.length}</dd>
          </div>
          <div
            className="flex items-center justify-between gap-3 pb-2"
            style={{ borderBottom: "1px solid #d1cfc5" }}
          >
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Tổng số lượng
            </dt>
            <dd className="m-0 text-[14px] font-semibold text-primary">{totalQuantity}</dd>
          </div>
          <div
            className="flex items-center justify-between gap-3 pb-2"
            style={{ borderBottom: "1px solid #d1cfc5" }}
          >
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
              Phương thức
            </dt>
            <dd className="m-0 text-[14px] font-semibold text-primary">Ví web</dd>
          </div>
          {order ? (
            <>
              <div
                className="flex items-center justify-between gap-3 pb-2"
                style={{ borderBottom: "1px solid #d1cfc5" }}
              >
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                  Mã đơn
                </dt>
                <dd className="m-0 text-[14px] font-semibold text-primary">#{order.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                  Trạng thái
                </dt>
                <dd
                  className="m-0 inline-flex items-center px-2.5 py-1 text-[12px] font-semibold text-primary"
                  style={{ border: "1px solid #141413" }}
                >
                  {statusLabel(liveStatus ?? order.status)}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        <div
          className="mt-5 p-3 text-[12px] font-normal"
          style={{ backgroundColor: "#faf9f5", border: "1px solid #d1cfc5" }}
        >
          <div
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: "#788c5d" }}
          >
            <ShieldCheck size={14} />
            Bảo mật phiên thanh toán
          </div>
          <p className="m-0 leading-relaxed text-secondary">
            Access token chỉ giữ trong bộ nhớ. Refresh token được backend đặt bằng HttpOnly cookie
            để giảm rủi ro lộ phiên.
          </p>
        </div>
      </aside>
    </section>
  );
}
