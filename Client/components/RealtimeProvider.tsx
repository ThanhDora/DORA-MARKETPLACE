"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL, type ApiList, type AppNotification, type OrderStatus } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type StockUpdate = { productId: string; stock: number };
type OrderUpdate = { orderId: number; status: OrderStatus };
type Notification = {
  id?: number;
  title?: string;
  content?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
};
type ProductMetricsUpdate = {
  productId: string;
  stock?: number;
  soldCount?: number;
  viewCount?: number;
  rating?: number;
  reviewsCount?: number;
};
type ProductReviewUpdate = {
  productId: string;
  type?: "created" | "updated" | "deleted";
  reviewId?: number;
  updatedAt?: string;
};

import type { ProductType } from "@/lib/api";

type ProductUpdate = {
  productId: string;
  name?: string;
  price?: number;
  stock?: number;
  images?: string[];
  description?: string;
  slug?: string;
  type?: ProductType;
};

type RealtimeContextValue = {
  isConnected: boolean;
  stockUpdates: Record<string, number>;
  orderUpdates: Record<number, OrderStatus>;
  productMetrics: Record<string, ProductMetricsUpdate>;
  productFeedVersion: number;
  reviewVersionByProduct: Record<string, number>;
  productUpdates: Record<string, ProductUpdate>;
  notifications: Notification[];
  unreadNotificationCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notification: Notification) => void;
  markAllNotificationsAsRead: () => void;
  cartVersion: number;
  walletVersion: number;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const NOTIFICATION_REFRESH_INTERVAL_MS = 15_000;

function toNotificationKey(notification: Notification) {
  if (typeof notification.id === "number") return `id:${notification.id}`;
  return `sig:${notification.type ?? ""}:${notification.title ?? ""}:${notification.content ?? ""}:${notification.createdAt ?? ""}`;
}

function normalizeNotification(notification: Partial<AppNotification> & Notification): Notification {
  return {
    id: typeof notification.id === "number" ? notification.id : undefined,
    title: notification.title,
    content: notification.content,
    type: notification.type ?? "GENERAL",
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt ?? new Date().toISOString(),
  };
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { accessToken, apiFetch, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [orderUpdates, setOrderUpdates] = useState<Record<number, OrderStatus>>({});
  const [productMetrics, setProductMetrics] = useState<Record<string, ProductMetricsUpdate>>({});
  const [productFeedVersion, setProductFeedVersion] = useState(0);
  const [reviewVersionByProduct, setReviewVersionByProduct] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cartVersion, setCartVersion] = useState(0);
  const [walletVersion, setWalletVersion] = useState(0);
  const [productUpdates, setProductUpdates] = useState<Record<string, ProductUpdate>>({});
  const lastNotificationRefreshAt = useRef(0);
  const notificationRefreshPromise = useRef<Promise<void> | null>(null);

  const refreshNotifications = useCallback(async (force = false) => {
    if (!isAuthenticated || !accessToken) {
      setNotifications([]);
      return;
    }

    if (!force && Date.now() - lastNotificationRefreshAt.current < NOTIFICATION_REFRESH_INTERVAL_MS) {
      return;
    }

    if (notificationRefreshPromise.current) {
      return notificationRefreshPromise.current;
    }

    notificationRefreshPromise.current = (async () => {
      try {
        const response = await apiFetch<ApiList<AppNotification>>("/users/me/notifications?limit=20", { notifySuccess: false });
        setNotifications((response.data || []).map((item) => normalizeNotification(item)));
        lastNotificationRefreshAt.current = Date.now();
      } catch {
        // Keep previous notifications if refresh fails.
      } finally {
        notificationRefreshPromise.current = null;
      }
    })();

    return notificationRefreshPromise.current;
  }, [accessToken, apiFetch, isAuthenticated]);

  const markNotificationAsRead = useCallback((notification: Notification) => {
    const key = toNotificationKey(notification);
    setNotifications((current) =>
      current.map((item) => (toNotificationKey(item) === key ? { ...item, isRead: true } : item)),
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setNotifications([]);
      return;
    }
    refreshNotifications(true);
  }, [accessToken, refreshNotifications]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      refreshNotifications();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAuthenticated, refreshNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    const interval = window.setInterval(() => {
      void refreshNotifications();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [accessToken, isAuthenticated, refreshNotifications]);

  useEffect(() => {
    if (!accessToken) {
      setIsConnected(false);
      return;
    }

    const socket: Socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", () => setIsConnected(false));

    socket.on("product:stock:update", (payload: StockUpdate) => {
      if (payload?.productId) {
        setStockUpdates((current) => ({ ...current, [String(payload.productId)]: payload.stock }));
        setProductFeedVersion((current) => current + 1);
      }
    });

    socket.on("product:metrics:update", (payload: ProductMetricsUpdate) => {
      if (!payload?.productId) return;
      const productId = String(payload.productId);
      setProductMetrics((current) => ({
        ...current,
        [productId]: {
          ...current[productId],
          ...payload,
          productId,
        },
      }));
      if (typeof payload.stock === "number") {
        setStockUpdates((current) => ({ ...current, [productId]: payload.stock as number }));
      }
      setProductFeedVersion((current) => current + 1);
    });

    socket.on("product:review:updated", (payload: ProductReviewUpdate) => {
      if (!payload?.productId) return;
      const productId = String(payload.productId);
      setReviewVersionByProduct((current) => ({
        ...current,
        [productId]: (current[productId] ?? 0) + 1,
      }));
    });

    socket.on("order:updated", (payload: OrderUpdate) => {
      if (payload?.orderId && payload.status) {
        setOrderUpdates((current) => ({ ...current, [payload.orderId]: payload.status }));
      }
    });

    const pushIncomingNotification = (payload: Notification) => {
      const incoming = normalizeNotification({ ...payload, isRead: false });
      setNotifications((current) => {
        const next = typeof incoming.id === "number"
          ? [incoming, ...current.filter((item) => item.id !== incoming.id)]
          : [incoming, ...current];
        return next.slice(0, 20);
      });
      void refreshNotifications(true);
    };

    socket.on("notification", pushIncomingNotification);
    socket.on("notification:new", pushIncomingNotification);

    socket.on("cart:updated", () => {
      setCartVersion((current) => current + 1);
    });

    socket.on("wallet:updated", () => {
      setWalletVersion((current) => current + 1);
    });

    socket.on("product:updated", (payload: ProductUpdate) => {
      if (!payload?.productId) return;
      setProductUpdates((current) => ({
        ...current,
        [payload.productId]: payload,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, refreshNotifications]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      isConnected,
      stockUpdates,
      orderUpdates,
      productMetrics,
      productFeedVersion,
      reviewVersionByProduct,
      notifications,
      unreadNotificationCount,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      cartVersion,
      walletVersion,
      productUpdates,
    }),
    [
      cartVersion,
      isConnected,
      markAllNotificationsAsRead,
      markNotificationAsRead,
      notifications,
      orderUpdates,
      productFeedVersion,
      productMetrics,
      refreshNotifications,
      reviewVersionByProduct,
      stockUpdates,
      unreadNotificationCount,
      walletVersion,
      productUpdates,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return context;
}
