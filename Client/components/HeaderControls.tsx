"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ShoppingCart, UserCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { CART_UPDATED_EVENT } from "@/lib/cart-events";
import type { ApiEnvelope } from "@/lib/api";

type Theme = "light" | "dark";

type CartCountResponse = {
  items?: { quantity?: number }[];
};

type NavLink = {
  href: string;
  label: string;
  badgeCount?: number;
};

const storageKey = "dora-marketplace-theme";
const navigationId = "primary-navigation";

const baseNavLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/catalog", label: "Sản phẩm" },
];

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const theme = window.localStorage.getItem(storageKey);
  return theme === "light" || theme === "dark" ? theme : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.2 14.3A8.5 8.5 0 0 1 9.7 3.8 8.5 8.5 0 1 0 20.2 14.3Z" />
    </svg>
  );
}

function notificationItemKey(item: { id?: number; title?: string; type?: string; content?: string }, index: number) {
  if (typeof item.id === "number") return `id:${item.id}`;
  return `${item.title ?? item.type ?? "notification"}-${item.content ?? ""}-${index}`;
}

function isApprovalNotification(item: { type?: string }, role?: string) {
  if (role !== "ADMIN") return false;
  const type = String(item.type || "").toUpperCase();
  return type === "PRODUCT_PENDING";
}

function formatNotificationTime(input?: string) {
  if (!input) return "Vừa xong";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function notificationTypeLabel(type?: string) {
  const normalized = String(type || "").toUpperCase();
  if (!normalized || normalized === "GENERAL") return "Thông báo";
  if (normalized === "PRODUCT_PENDING") return "Chờ duyệt";
  if (normalized === "PRODUCT_APPROVED") return "Đã duyệt";
  if (normalized === "PRODUCT_REJECTED") return "Từ chối";
  return normalized.replace(/_/g, " ");
}

export function HeaderControls() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { notifications, cartVersion, unreadNotificationCount, markNotificationAsRead } = useRealtime();
  const [theme, setTheme] = useState<Theme>("light");
  const [cartCount, setCartCount] = useState(0);
  const [isRealtimeFlash, setIsRealtimeFlash] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<(typeof notifications)[number] | null>(null);
  const previousUnreadRef = useRef(0);

  useEffect(() => {
    const nextTheme = getStoredTheme() ?? "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedNotification(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const loadCartCount = useCallback(async () => {
    if (!isAuthenticated || isInitializing) {
      setCartCount(0);
      return;
    }

    try {
      const response = await apiFetch<ApiEnvelope<CartCountResponse>>("/cart");
      const nextCount = (response.data.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      setCartCount(nextCount);
    } catch {
      setCartCount(0);
    }
  }, [apiFetch, isAuthenticated, isInitializing]);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadCartCount();
  }, [cartVersion, isAuthenticated, loadCartCount]);

  useEffect(() => {
    function refreshCartCount() {
      loadCartCount();
    }

    window.addEventListener(CART_UPDATED_EVENT, refreshCartCount);
    window.addEventListener("focus", refreshCartCount);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, refreshCartCount);
      window.removeEventListener("focus", refreshCartCount);
    };
  }, [loadCartCount]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  const nextLabel = theme === "dark" ? "sáng" : "tối";

  const unreadNotifications = unreadNotificationCount;

  useEffect(() => {
    if (unreadNotifications > previousUnreadRef.current) {
      setIsRealtimeFlash(true);
      const timer = setTimeout(() => setIsRealtimeFlash(false), 1800);
      previousUnreadRef.current = unreadNotifications;
      return () => clearTimeout(timer);
    }
    previousUnreadRef.current = unreadNotifications;
  }, [unreadNotifications]);

  const navLinks: NavLink[] = [...baseNavLinks];
  if (isAuthenticated && (user?.role === "SELLER" || user?.role === "ADMIN")) {
    navLinks.push({ href: "/seller", label: "Kênh bán" });
  }

  const markNotificationRead = useCallback(async (item: (typeof notifications)[number]) => {
    if (item.isRead) return;
    markNotificationAsRead(item);
    if (typeof item.id !== "number") return;
    try {
      await apiFetch(`/users/me/notifications/${item.id}/read`, { method: "PATCH", notifySuccess: false });
    } catch {
      // Keep optimistic UI for better realtime experience.
    }
  }, [apiFetch, markNotificationAsRead]);

  const openNotificationModal = useCallback(async (item: (typeof notifications)[number]) => {
    await markNotificationRead(item);
    setSelectedNotification(item);
  }, [markNotificationRead]);

  const openApprovalPage = useCallback(async (item: (typeof notifications)[number]) => {
    await markNotificationRead(item);
    router.push("/admin?tab=pending");
  }, [markNotificationRead, router]);

  return (
    <div className="header-controls">
      <nav
        id={navigationId}
        className="nav-links"
        aria-label="Điều hướng chính"
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link key={link.href} href={link.href} aria-current={isActive ? "page" : undefined}>
              <span className="nav-link-content">
                <span>{link.label}</span>
                {link.badgeCount && link.badgeCount > 0 ? (
                  <span className="nav-link-badge">{link.badgeCount > 99 ? "99+" : link.badgeCount}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/cart"
        className="cart-entry"
        aria-label={`Giỏ hàng${cartCount > 0 ? `, ${cartCount} sản phẩm` : ""}`}
        title="Giỏ hàng"
      >
        <ShoppingCart size={18} />
        <span>Giỏ hàng</span>
        {cartCount > 0 ? <strong>{cartCount > 99 ? "99+" : cartCount}</strong> : null}
      </Link>

      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Chuyển sang giao diện ${nextLabel}`}
        title={`Chuyển sang giao diện ${nextLabel}`}
        aria-pressed={theme === "dark"}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="notification-menu">
        <Link
          href="/account/notifications"
          className={[
            "notification-entry",
            unreadNotifications > 0 ? "has-unread" : "",
            isRealtimeFlash ? "realtime-flash" : "",
          ].filter(Boolean).join(" ")}
          aria-label={`Thông báo${unreadNotifications ? ` (${unreadNotifications} chưa đọc)` : ""}`}
          title="Thông báo"
        >
          <Bell size={18} />
          {unreadNotifications > 0 ? (
            <span className="notification-badge">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
          ) : null}
        </Link>
        <div className="notification-popover">
          <div className="notification-popover__head">
            <div className="notification-popover__title">
              <strong>Thông báo</strong>
              {unreadNotifications > 0 ? (
                <span>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
              ) : null}
            </div>
            <Link href="/account/notifications">Xem tất cả thông báo</Link>
          </div>
          {notifications.length > 0 ? (
            <div className="notification-popover__list">
              {notifications.slice(0, 5).map((item, index) => {
                const key = notificationItemKey(item, index);
                const toApprovalPage = isApprovalNotification(item, user?.role);
                const itemType = notificationTypeLabel(item.type);
                const isUnread = !item.isRead;
                const itemClassName = [
                  "notification-popover__item",
                  toApprovalPage ? "is-approval" : "",
                  isUnread ? "is-unread" : "",
                ].filter(Boolean).join(" ");

                if (toApprovalPage) {
                  return (
                    <button
                      key={key}
                      type="button"
                      className={itemClassName}
                      onClick={() => openApprovalPage(item)}
                    >
                      <div className="notification-popover__item-top">
                        <strong>{item.title ?? item.type ?? "Thông báo"}</strong>
                        <small>{itemType}</small>
                      </div>
                      <span className="notification-popover__item-content">{item.content ?? ""}</span>
                      <div className="notification-popover__item-meta">
                        <time>{formatNotificationTime(item.createdAt)}</time>
                        <em>Đi đến duyệt</em>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    className={itemClassName}
                    onClick={() => openNotificationModal(item)}
                  >
                    <div className="notification-popover__item-top">
                      <strong>{item.title ?? item.type ?? "Thông báo"}</strong>
                      <small>{itemType}</small>
                    </div>
                    <span className="notification-popover__item-content">{item.content ?? ""}</span>
                    <div className="notification-popover__item-meta">
                      <time>{formatNotificationTime(item.createdAt)}</time>
                      <em>Mở chi tiết</em>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="notification-popover__empty">Chưa có thông báo mới.</p>
          )}
        </div>
      </div>

      {selectedNotification ? (
        <div className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-modal-title">
          <button
            type="button"
            aria-label="Đóng chi tiết thông báo"
            className="notification-modal__backdrop"
            onClick={() => setSelectedNotification(null)}
          />
          <article className="notification-modal__panel">
            <div className="notification-modal__head">
              <h3 id="notification-modal-title">{selectedNotification.title ?? selectedNotification.type ?? "Thông báo"}</h3>
              <button type="button" className="notification-modal__close" onClick={() => setSelectedNotification(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="notification-modal__time">{formatNotificationTime(selectedNotification.createdAt)}</p>
            <div className="notification-modal__content">
              <p>{selectedNotification.content ?? "Không có nội dung."}</p>
            </div>
            <div className="notification-modal__actions">
              <button
                type="button"
                className="notification-modal__btn notification-modal__btn--ghost"
                onClick={() => setSelectedNotification(null)}
              >
                Đóng
              </button>
              <Link
                href="/account/notifications"
                className="notification-modal__btn notification-modal__btn--primary"
                onClick={() => setSelectedNotification(null)}
              >
                Xem tất cả thông báo
              </Link>
            </div>
          </article>
        </div>
      ) : null}

      <div className="account-actions">
        {isInitializing ? (
          <span className="account-skeleton" aria-hidden="true" />
        ) : isAuthenticated ? (
          <Link href="/account" className="account-pill" title={user?.email ?? "Tài khoản"}>
            <UserCircle size={17} />
            <span>{user?.name}</span>
          </Link>
        ) : (
          <Link href="/account" className="account-pill">
            <UserCircle size={17} />
            <span>Tài khoản</span>
          </Link>
        )}
      </div>
    </div>
  );
}
