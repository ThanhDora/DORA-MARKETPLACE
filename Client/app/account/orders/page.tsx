"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackageCheck, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCurrency,
  paymentMethodLabel,
  statusLabel,
  type ApiList,
  type Order,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { orderUpdates } = useRealtime();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersRef = useRef<Order[]>([]);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setTotalOrders(0);
      return;
    }
    try {
      const response = await apiFetch<ApiList<Order>>("/orders?limit=50", { notifySuccess: false });
      setOrders(response.data);
      setTotalOrders(response.pagination?.total ?? response.data.length);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải đơn hàng.");
    }
  }, [apiFetch, isAuthenticated, showToast]);

  const orderUpdateSignature = useMemo(
    () =>
      Object.entries(orderUpdates)
        .map(([orderId, status]) => `${orderId}:${status}`)
        .sort()
        .join("|"),
    [orderUpdates],
  );

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(() => {
      void loadOrders();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadOrders]);

  useEffect(() => {
    if (!isAuthenticated || !orderUpdateSignature) return;

    const currentOrders = ordersRef.current;
    const knownOrderIds = new Set(currentOrders.map((order) => order.id));
    const hasUnknownOrder = Object.keys(orderUpdates).some((rawId) => {
      const orderId = Number(rawId);
      return Number.isFinite(orderId) && !knownOrderIds.has(orderId);
    });

    setOrders((current) => {
      let changed = false;
      const next = current.map((order) => {
        const liveStatus = orderUpdates[order.id];
        if (liveStatus && liveStatus !== order.status) {
          changed = true;
          return { ...order, status: liveStatus };
        }
        return order;
      });
      return changed ? next : current;
    });

    if (hasUnknownOrder) {
      void loadOrders();
    }
  }, [isAuthenticated, loadOrders, orderUpdateSignature, orderUpdates]);

  if (isInitializing) {
    return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem đơn hàng của bạn.</p>
          <Link href="/login?next=/account/orders" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="px-inline py-block">
      <section className="flex flex-wrap items-center justify-between gap-[14px] mb-[34px]">
        <div>
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 mb-[14px] text-[13px] font-extrabold text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <h1>Đơn hàng của bạn</h1>
          <p>Theo dõi trạng thái đơn hàng realtime.</p>
        </div>
        <div className="flex items-center gap-[7px]">
          <span>
            <ShieldCheck size={16} />
            {user?.role}
          </span>
          <span>
            <PackageCheck size={16} />
            {totalOrders} đơn hàng
          </span>
        </div>
      </section>

      <article className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
        <div className="flex items-center gap-[14px] mb-4">
          <PackageCheck size={20} />
          <h2>Tất cả đơn hàng</h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Số lượng</th>
                <th>Tổng</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/order/${order.id}/success`)}
                  className="cursor-pointer"
                >
                  <td>#{order.id}</td>
                  <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>{formatCurrency(order.totalAmount)}</td>
                  <td>{paymentMethodLabel(order.paymentMethod)}</td>
                  <td>{statusLabel(orderUpdates[order.id] ?? order.status)}</td>
                </tr>
              ))}
              {!orders.length ? (
                <tr>
                  <td colSpan={5}>Chưa có đơn hàng.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </main>
  );
}
