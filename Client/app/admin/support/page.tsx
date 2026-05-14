"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bot,
  Headphones,
  Inbox,
  MessageCircle,
  RefreshCcw,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { SOCKET_URL, type ApiEnvelope, type ApiList } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

type MsgRole = "user" | "assistant" | "agent" | "system";

type SupportMsg = {
  id: number;
  ticketId: number;
  senderId: number | null;
  content: string;
  role: MsgRole;
  createdAt: string;
  sender?: { id: number; name: string; avatar?: string | null } | null;
};

type TicketUser = { id: number; name: string; email: string; avatar?: string | null };
type TicketAgent = { id: number; name: string; avatar?: string | null };
type TicketStatus = "AI" | "PENDING_HUMAN" | "WITH_HUMAN" | "CLOSED";

type Ticket = {
  id: number;
  status: TicketStatus;
  subject: string;
  updatedAt: string;
  user: TicketUser;
  agent: TicketAgent | null;
  _count: { messages: number };
  messages: { content: string; createdAt: string; role: string }[];
};

type Stats = { pending: number; withHuman: number; total: number };

const STATUS_LABELS: Record<TicketStatus, string> = {
  AI: "AI",
  PENDING_HUMAN: "Chờ nhân viên",
  WITH_HUMAN: "Đang hỗ trợ",
  CLOSED: "Đã đóng",
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  AI: "badge-ai",
  PENDING_HUMAN: "badge-pending",
  WITH_HUMAN: "badge-human",
  CLOSED: "badge-closed",
};

// Ticket đã được admin trả lời nếu tin nhắn cuối là của agent/assistant
function isReplied(t: Ticket) {
  const last = t.messages[0];
  if (!last) return false;
  return last.role === "agent" || last.role === "assistant";
}

// Thông báo desktop
function pushDesktopNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const send = () => new Notification(title, { body, icon: "/logo.jpg", silent: false });
  if (Notification.permission === "granted") {
    send();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => { if (p === "granted") send(); });
  }
}

export default function AdminSupportPage() {
  const { user, isAuthenticated, isInitializing, apiFetch, accessToken } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, withHuman: 0, total: 0 });
  const [filter, setFilter] = useState<string>("PENDING_HUMAN");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const adminTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ticketId → số tin nhắn chưa đọc
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<Ticket | null>(null);
  selectedRef.current = selected;

  // Xin quyền thông báo khi vào trang
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isInitializing && (!isAuthenticated || user?.role !== "ADMIN")) {
      router.replace("/");
    }
  }, [isAuthenticated, isInitializing, router, user]);

  // Socket — tạo một lần
  useEffect(() => {
    if (!accessToken) return;
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const cur = selectedRef.current;
      if (cur) socket.emit("support:join", cur.id);
    });

    socket.on("support:new_pending", ({ ticket }: { ticket: Ticket }) => {
      setTickets((prev) => {
        const exists = prev.some((t) => t.id === ticket.id);
        if (exists) return prev.map((t) => (t.id === ticket.id ? { ...t, status: "PENDING_HUMAN" } : t));
        return [ticket, ...prev];
      });
      setStats((s) => ({ ...s, pending: s.pending + 1 }));
      // Thông báo desktop khi có ticket mới chờ nhân viên
      pushDesktopNotification(
        "Yêu cầu hỗ trợ mới",
        `${ticket.user.name} đang chờ nhân viên hỗ trợ`
      );
    });

    socket.on("support:message", (msg: SupportMsg) => {
      if (msg.ticketId === selectedRef.current?.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === msg.ticketId
            ? {
                ...t,
                messages: [{ content: msg.content, createdAt: msg.createdAt, role: msg.role }],
                updatedAt: msg.createdAt,
              }
            : t
        )
      );

      // Chỉ đếm + thông báo khi tin nhắn từ user (khách hàng)
      if (msg.role === "user") {
        const isViewing = msg.ticketId === selectedRef.current?.id;
        if (!isViewing) {
          setUnreadCounts((prev) => ({
            ...prev,
            [msg.ticketId]: (prev[msg.ticketId] ?? 0) + 1,
          }));
        }
        // Tên người gửi hoặc fallback
        const senderName = msg.sender?.name ?? "Khách hàng";
        pushDesktopNotification(
          `Tin nhắn từ ${senderName}`,
          msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content
        );
      }
    });

    socket.on("support:closed", ({ ticketId }: { ticketId: number }) => {
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: "CLOSED" } : t)));
      if (selectedRef.current?.id === ticketId) {
        setSelected((t) => (t ? { ...t, status: "CLOSED" } : t));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  // Join room khi chọn ticket
  useEffect(() => {
    if (!selected) return;
    const socket = socketRef.current;
    if (socket?.connected) socket.emit("support:join", selected.id);
  }, [selected]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter !== "ALL" ? `?status=${filter}&limit=50` : `?limit=50`;
      const [ticketRes, statsRes] = await Promise.all([
        apiFetch<ApiList<Ticket>>(`/support/admin/tickets${query}`, { notifySuccess: false }),
        apiFetch<ApiEnvelope<Stats>>("/support/admin/tickets/stats", { notifySuccess: false }),
      ]);
      setTickets(ticketRes.data ?? []);
      setStats(statsRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    if (isAuthenticated) void loadTickets();
  }, [isAuthenticated, loadTickets]);

  async function selectTicket(t: Ticket) {
    setSelected(t);
    setMessages([]);
    // Xóa unread khi mở ticket
    setUnreadCounts((prev) => ({ ...prev, [t.id]: 0 }));
    try {
      const res = await apiFetch<ApiList<SupportMsg>>(
        `/support/admin/tickets/${t.id}/messages?limit=100`,
        { notifySuccess: false }
      );
      setMessages(res.data ?? []);
    } catch {}
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function emitAdminTyping(isTyping: boolean) {
    if (!selected) return;
    socketRef.current?.emit("support:typing", { ticketId: selected.id, isTyping });
  }

  function handleDraftChange(val: string) {
    setDraft(val);
    emitAdminTyping(true);
    if (adminTypingTimer.current) clearTimeout(adminTypingTimer.current);
    adminTypingTimer.current = setTimeout(() => emitAdminTyping(false), 2000);
  }

  async function handleReply(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setDraft("");
    setSending(true);
    emitAdminTyping(false);
    try {
      const res = await apiFetch<ApiEnvelope<{ message: SupportMsg; ticket: Ticket }>>(
        `/support/admin/tickets/${selected.id}/reply`,
        { method: "POST", body: JSON.stringify({ content: text }), notifySuccess: false }
      );
      setSelected((t) => (t ? { ...t, status: res.data.ticket.status } : t));
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? {
                ...t,
                status: res.data.ticket.status,
                messages: [{ content: text, createdAt: new Date().toISOString(), role: "agent" }],
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function handleClose(ticketId: number) {
    try {
      await apiFetch(`/support/admin/tickets/${ticketId}/close`, { method: "PATCH", notifySuccess: false });
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: "CLOSED" } : t)));
      if (selected?.id === ticketId) setSelected((t) => (t ? { ...t, status: "CLOSED" } : t));
    } catch {}
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isInitializing) return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;
  if (!isAuthenticated || user?.role !== "ADMIN") return null;

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <main className="support-admin-page">
      {/* Sidebar */}
      <aside className="support-admin-sidebar">
        <div className="support-admin-sidebar__head">
          <div>
            <h1>
              Hỗ trợ khách hàng
              {totalUnread > 0 && (
                <span className="support-admin-sidebar__total-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
              )}
            </h1>
            <p>{stats.total} cuộc trò chuyện đang mở</p>
          </div>
          <button type="button" onClick={loadTickets} disabled={loading} aria-label="Làm mới">
            <RefreshCcw size={15} className={loading ? "spin" : ""} />
          </button>
        </div>

        <div className="support-admin-sidebar__stats">
          <div className="support-admin-sidebar__stat support-admin-sidebar__stat--pending">
            <strong>{stats.pending}</strong>
            <span>Chờ nhân viên</span>
          </div>
          <div className="support-admin-sidebar__stat support-admin-sidebar__stat--human">
            <strong>{stats.withHuman}</strong>
            <span>Đang hỗ trợ</span>
          </div>
        </div>

        <div className="support-admin-sidebar__filters">
          {(["PENDING_HUMAN", "WITH_HUMAN", "AI", "CLOSED", "ALL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`support-admin-filter-btn ${filter === s ? "support-admin-filter-btn--active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s === "ALL" ? "Tất cả" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="support-admin-sidebar__list">
          {tickets.length === 0 && !loading && (
            <div className="support-admin-sidebar__empty">
              <Inbox size={28} />
              <p>Không có ticket nào</p>
            </div>
          )}
          {tickets.map((t) => {
            const unread = unreadCounts[t.id] ?? 0;
            const replied = isReplied(t);
            const lastMsg = t.messages[0];

            return (
              <button
                key={t.id}
                type="button"
                className={[
                  "support-admin-ticket",
                  selected?.id === t.id ? "support-admin-ticket--active" : "",
                  replied && selected?.id !== t.id ? "support-admin-ticket--replied" : "",
                  unread > 0 ? "support-admin-ticket--unread" : "",
                ].join(" ")}
                onClick={() => selectTicket(t)}
              >
                <div className="support-admin-ticket__top">
                  <span className="support-admin-ticket__name">{t.user.name}</span>
                  <div className="support-admin-ticket__top-right">
                    <span className={`support-admin-ticket__badge ${STATUS_CLASS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                    {unread > 0 && (
                      <span className="support-admin-ticket__unread">{unread > 99 ? "99+" : unread}</span>
                    )}
                  </div>
                </div>

                <div className="support-admin-ticket__preview-row">
                  {lastMsg && (
                    <span className="support-admin-ticket__role-dot" data-role={lastMsg.role} />
                  )}
                  <p className="support-admin-ticket__preview">
                    {lastMsg
                      ? (lastMsg.role === "agent" ? "Bạn: " : lastMsg.role === "assistant" ? "AI: " : "")
                        + lastMsg.content
                      : "Chưa có tin nhắn"}
                  </p>
                </div>

                <time className="support-admin-ticket__time">
                  {new Date(t.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main panel */}
      <section className="support-admin-main">
        {!selected ? (
          <div className="support-admin-main__placeholder">
            <MessageCircle size={48} />
            <h2>Chọn một ticket</h2>
            <p>Chọn cuộc trò chuyện bên trái để bắt đầu hỗ trợ</p>
          </div>
        ) : (
          <>
            <div className="support-admin-main__header">
              <div className="support-admin-main__user">
                <div className="support-admin-main__avatar">
                  <UserRound size={16} />
                </div>
                <div>
                  <strong>{selected.user.name}</strong>
                  <span>{selected.user.email}</span>
                </div>
              </div>
              <div className="support-admin-main__actions">
                <span className={`support-admin-ticket__badge ${STATUS_CLASS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
                {selected.status !== "CLOSED" && (
                  <button
                    type="button"
                    className="support-admin-close-btn"
                    onClick={() => handleClose(selected.id)}
                  >
                    <X size={14} />
                    Đóng ticket
                  </button>
                )}
              </div>
            </div>

            <div className="support-admin-main__messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`support-msg support-msg--${msg.role}`}>
                  {msg.role === "system" ? (
                    <span className="support-msg__system">{msg.content}</span>
                  ) : (
                    <>
                      {msg.role !== "user" && (
                        <div className="support-msg__avatar">
                          {msg.role === "assistant" ? <Bot size={12} /> : <Headphones size={12} />}
                        </div>
                      )}
                      <div className="support-msg__bubble">
                        <MarkdownMessage content={msg.content} isUser={msg.role === "user"} />
                        <time>
                          {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {selected.status !== "CLOSED" && (
              <form className="support-admin-main__input" onSubmit={handleReply}>
                <textarea
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder="Trả lời khách hàng... (Enter để gửi)"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleReply();
                    }
                  }}
                  disabled={sending}
                />
                <button type="submit" disabled={!draft.trim() || sending}>
                  <Send size={16} />
                  Gửi
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
