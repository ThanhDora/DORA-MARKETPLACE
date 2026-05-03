"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Check, CheckCheck, Clock3, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { type ApiList, type AppNotification } from "@/lib/api";

type FeedNotification = {
  id?: number;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt?: string;
};

type NotificationFilter = "ALL" | "UNREAD" | "READ";

function toFeedNotification(item: Partial<AppNotification> & { id?: number }): FeedNotification {
  return {
    id: typeof item.id === "number" ? item.id : undefined,
    title: item.title?.trim() || "Thông báo",
    content: item.content?.trim() || "Có cập nhật mới.",
    type: item.type?.trim() || "GENERAL",
    isRead: Boolean(item.isRead),
    createdAt: item.createdAt,
  };
}

function toNotificationKey(item: FeedNotification) {
  if (typeof item.id === "number") return `id:${item.id}`;
  return `sig:${item.type}:${item.title}:${item.content}`;
}

function formatDateLabel(input?: string) {
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

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, apiFetch } = useAuth();
  const {
    notifications: liveNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    refreshNotifications,
  } = useRealtime();

  const [notificationItems, setNotificationItems] = useState<FeedNotification[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [selectedNotif, setSelectedNotif] = useState<FeedNotification | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationItems([]);
      setIsLoadingFeed(false);
      return;
    }

    let isMounted = true;
    setIsLoadingFeed(true);

    apiFetch<ApiList<AppNotification>>("/users/me/notifications?limit=50", { notifySuccess: false })
      .then((response) => {
        if (!isMounted) return;
        const mapped = (response.data || []).map((item) => toFeedNotification(item));
        setNotificationItems(mapped);
      })
      .catch(() => {
        if (!isMounted) return;
        setNotificationItems([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFeed(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiFetch, isAuthenticated]);

  useEffect(() => {
    if (!liveNotifications.length) return;

    setNotificationItems((current) => {
      const currentKeys = new Set(current.map((item) => toNotificationKey(item)));
      const incoming = liveNotifications
        .map((item) =>
          toFeedNotification({
            id: item.id,
            title: item.title,
            content: item.content,
            type: item.type,
            isRead: false,
          }),
        )
        .filter((item) => !currentKeys.has(toNotificationKey(item)));

      if (!incoming.length) return current;
      return [...incoming, ...current].slice(0, 100);
    });
  }, [liveNotifications]);

  async function markItemRead(item: FeedNotification) {
    if (item.isRead) return;

    setNotificationItems((current) =>
      current.map((entry) =>
        toNotificationKey(entry) === toNotificationKey(item) ? { ...entry, isRead: true } : entry,
      ),
    );
    markNotificationAsRead(item);

    if (typeof item.id === "number") {
      try {
        await apiFetch(`/users/me/notifications/${item.id}/read`, { method: "PATCH", notifySuccess: false });
      } catch {
        setNotificationItems((current) =>
          current.map((entry) =>
            toNotificationKey(entry) === toNotificationKey(item) ? { ...entry, isRead: false } : entry,
          ),
        );
        refreshNotifications();
      }
    }
  }

  async function markAllRead() {
    const hasUnread = notificationItems.some((item) => !item.isRead);
    if (!hasUnread) return;

    setIsMarkingAll(true);
    const snapshot = notificationItems;
    setNotificationItems((current) => current.map((item) => ({ ...item, isRead: true })));
    markAllNotificationsAsRead();

    try {
      await apiFetch("/users/me/notifications/read-all", { method: "PATCH", notifySuccess: false });
    } catch {
      setNotificationItems(snapshot);
      refreshNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  }

  const unreadCount = useMemo(
    () => notificationItems.filter((item) => !item.isRead).length,
    [notificationItems],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "READ") return notificationItems.filter((item) => item.isRead);
    if (filter === "UNREAD") return notificationItems.filter((item) => !item.isRead);
    return notificationItems;
  }, [filter, notificationItems]);

  if (isInitializing) {
    return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem thông báo.</p>
          <Link href="/login?next=/account/notifications" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="px-inline py-block">
      <section className="mb-5 overflow-hidden rounded-[24px] border border-card-border bg-surface shadow-soft">
        <div className="relative grid gap-4 p-[clamp(20px,2.8vw,30px)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-tertiary/15 blur-3xl" />
          <div>
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 mb-[12px] text-[13px] font-extrabold text-secondary hover:text-primary transition-colors">
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <h1 className="mb-2">Thông báo của bạn</h1>
            <p className="m-0 text-secondary">Đã xem sẽ được giữ lại và hiển thị mờ hơn để bạn dễ theo dõi lịch sử.</p>
          </div>
          <div className="grid gap-2 text-sm font-bold text-primary">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-neutral px-3 py-2">
              <ShieldCheck size={16} />
              {user?.role}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-neutral px-3 py-2">
              <Bell size={16} />
              {notificationItems.length} thông báo
            </span>
          </div>
        </div>
      </section>

      <article className="rounded-[24px] border border-card-border bg-surface p-[clamp(18px,2.4vw,28px)] shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-neutral p-1">
            {(["ALL", "UNREAD", "READ"] as NotificationFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={`min-h-[34px] rounded-full px-3 text-xs font-extrabold transition-all ${
                  filter === mode
                    ? "bg-surface text-primary shadow-[0_6px_14px_rgba(0,0,0,0.08)]"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {mode === "ALL" ? "Tất cả" : mode === "UNREAD" ? "Chưa xem" : "Đã xem"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={isMarkingAll || unreadCount === 0}
            className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-border bg-neutral px-4 text-xs font-extrabold text-primary transition-all hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck size={15} />
            {isMarkingAll ? "Đang xử lý..." : "Đánh dấu đã xem tất cả"}
          </button>
        </div>

        {isLoadingFeed ? (
          <div className="skeleton-panel" />
        ) : filteredNotifications.length ? (
          <div className="grid gap-3">
            {filteredNotifications.map((item, index) => (
              <article
                key={`${toNotificationKey(item)}-${index}`}
                onClick={() => setSelectedNotif(item)}
                className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-medium ${
                  item.isRead
                    ? "border-border bg-neutral/80 opacity-60 hover:opacity-90"
                    : "border-tertiary/35 bg-tertiary/5 shadow-[0_10px_24px_rgba(14,165,233,0.12)] hover:-translate-y-[2px] hover:shadow-[0_14px_30px_rgba(14,165,233,0.18)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <strong className="truncate text-[15px] text-primary">{item.title}</strong>
                      <span className={`inline-flex min-h-[22px] items-center rounded-full px-2 text-[11px] font-extrabold ${item.isRead ? "bg-surface text-secondary" : "bg-tertiary/15 text-tertiary"}`}>
                        {item.isRead ? "Đã xem" : "Mới"}
                      </span>
                    </div>
                    <p className="m-0 line-clamp-2 text-sm text-secondary">{item.content}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-secondary">
                      <Clock3 size={13} />
                      {formatDateLabel(item.createdAt)}
                    </div>
                  </div>

                  {!item.isRead ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markItemRead(item); }}
                      className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full border border-tertiary/35 bg-surface px-3 text-[11px] font-extrabold text-tertiary transition-all hover:-translate-y-[1px] hover:bg-tertiary hover:text-on-accent"
                    >
                      <Check size={13} />
                      Đã xem
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-neutral p-4 text-center text-sm font-bold text-secondary">
            Không có thông báo phù hợp bộ lọc này.
          </p>
        )}
      </article>

      {selectedNotif ? (
        <div className="notification-modal" role="dialog" aria-modal="true">
          <div
            className="notification-modal__backdrop"
            onClick={() => {
              if (!selectedNotif.isRead) markItemRead(selectedNotif);
              setSelectedNotif(null);
            }}
          />
          <div className="notification-modal__panel">
            <div className="notification-modal__head">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex min-h-[22px] items-center rounded-full px-2.5 text-[11px] font-extrabold ${selectedNotif.isRead ? "bg-neutral text-secondary" : "bg-tertiary/15 text-tertiary"}`}>
                    {selectedNotif.isRead ? "Đã xem" : "Mới"}
                  </span>
                  <span className="inline-flex min-h-[22px] items-center rounded-full border border-border bg-neutral px-2.5 text-[11px] font-extrabold text-secondary">
                    {selectedNotif.type}
                  </span>
                </div>
                <h3>{selectedNotif.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedNotif.isRead) markItemRead(selectedNotif);
                  setSelectedNotif(null);
                }}
                className="notification-modal__close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="notification-modal__time">
              <Clock3 size={13} className="inline mr-1 -mt-px" />
              {formatDateLabel(selectedNotif.createdAt)}
            </p>

            <div className="notification-modal__content">
              <p>{selectedNotif.content}</p>
            </div>

            {!selectedNotif.isRead ? (
              <div className="notification-modal__actions">
                <button
                  type="button"
                  onClick={() => markItemRead(selectedNotif)}
                  className="notification-modal__btn notification-modal__btn--primary"
                >
                  <Check size={14} className="mr-1.5" />
                  Đánh dấu đã xem
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
