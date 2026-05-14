"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  Bot,
  ChevronLeft,
  Headphones,
  MessageCircle,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { SOCKET_URL, type ApiEnvelope, type ApiList } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { io, type Socket } from "socket.io-client";

type MsgRole = "user" | "assistant" | "agent" | "system";

type SupportMessage = {
  id: number;
  ticketId: number;
  senderId: number | null;
  content: string;
  role: MsgRole;
  isRead: boolean;
  createdAt: string;
  sender?: { id: number; name: string; avatar?: string | null } | null;
};

type SupportTicket = {
  id: number;
  status: "AI" | "PENDING_HUMAN" | "WITH_HUMAN" | "CLOSED";
  agent?: { id: number; name: string; avatar?: string | null } | null;
};

const STATUS_CONFIG = {
  AI:           { label: "Trợ lý AI",         sub: "Trực tuyến · Phản hồi ngay lập tức" },
  PENDING_HUMAN:{ label: "Đang tìm nhân viên", sub: "Vui lòng chờ trong giây lát..." },
  WITH_HUMAN:   { label: "Nhân viên hỗ trợ",  sub: "Đang kết nối trực tiếp" },
  CLOSED:       { label: "Hỗ trợ",             sub: "Cuộc trò chuyện đã kết thúc" },
};

export default function SupportPage() {
  const { user, isAuthenticated, isInitializing, apiFetch, accessToken } = useAuth();

  const [ticket, setTicket]     = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [loading, setLoading]   = useState(true);

  const socketRef    = useRef<Socket | null>(null);
  const bottomRef    = useRef<HTMLDivElement | null>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticketRef    = useRef<SupportTicket | null>(null);
  ticketRef.current  = ticket;

  /* ── Socket ─────────────────────────────────────────── */
  useEffect(() => {
    if (!accessToken) return;
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const t = ticketRef.current;
      if (t) socket.emit("support:join", t.id);
    });

    socket.on("support:message", (msg: SupportMessage) => {
      if (msg.role === "agent") setAgentTyping(false);
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });

    socket.on("support:agent_joined", ({
      systemMessage,
    }: { ticket: SupportTicket; systemMessage: SupportMessage }) => {
      setTicket((t) => (t ? { ...t, status: "WITH_HUMAN" } : t));
      setMessages((prev) =>
        prev.some((m) => m.id === systemMessage.id) ? prev : [...prev, systemMessage]
      );
    });

    socket.on("support:closed", () => {
      setTicket((t) => (t ? { ...t, status: "CLOSED" } : t));
    });

    socket.on("support:user_typing", ({ isTyping }: { isTyping: boolean }) => {
      setAgentTyping(isTyping);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [accessToken]);

  useEffect(() => {
    if (ticket && socketRef.current?.connected) {
      socketRef.current.emit("support:join", ticket.id);
    }
  }, [ticket]);

  /* ── Load ticket + messages ──────────────────────────── */
  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ApiEnvelope<SupportTicket>>(
        "/support/ticket", { notifySuccess: false }
      );
      setTicket(res.data);
      const msgs = await apiFetch<ApiList<SupportMessage>>(
        `/support/ticket/${res.data.id}/messages?limit=100`,
        { notifySuccess: false }
      );
      setMessages(msgs.data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAuthenticated) void loadTicket();
    else setLoading(false);
  }, [isAuthenticated, loadTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, agentTyping]);

  /* ── Actions ─────────────────────────────────────────── */
  const sendTyping = useCallback((isTyping: boolean) => {
    const t = ticketRef.current;
    if (!t) return;
    socketRef.current?.emit("support:typing", { ticketId: t.id, isTyping });
  }, []);

  function handleInputChange(val: string) {
    setDraft(val);
    sendTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTyping(false), 2000);
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !ticket || sending) return;
    setDraft("");
    setSending(true);
    sendTyping(false);
    if (ticket.status === "AI") setAiTyping(true);
    try {
      await apiFetch(`/support/ticket/${ticket.id}/message`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
        notifySuccess: false,
      });
      setAiTyping(false);
    } catch {
      setAiTyping(false);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function handleEscalate() {
    if (!ticket) return;
    try {
      await apiFetch(`/support/ticket/${ticket.id}/escalate`, {
        method: "POST",
        notifySuccess: false,
      });
      setTicket((t) => (t ? { ...t, status: "PENDING_HUMAN" } : t));
    } catch {}
  }

  async function handleNewChat() {
    setMessages([]);
    setTicket(null);
    await loadTicket();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const status = ticket?.status ?? "AI";
  const cfg    = STATUS_CONFIG[status];
  const isClosed  = status === "CLOSED";
  const isPending = status === "PENDING_HUMAN";
  const isHuman   = status === "WITH_HUMAN";
  const isAI      = status === "AI";

  /* ── Not logged in ───────────────────────────────────── */
  if (!isInitializing && !isAuthenticated) {
    return (
      <main className="sp-page sp-page--guest">
        <div className="sp-guest">
          <div className="sp-guest__icon"><MessageCircle size={40} /></div>
          <h1>Trung tâm hỗ trợ</h1>
          <p>Đăng nhập để chat với trợ lý AI hoặc nhân viên hỗ trợ DORA.</p>
          <Link href="/login?next=/support" className="sp-guest__btn">
            Đăng nhập để bắt đầu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="sp-page">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sp-sidebar">
        {/* Brand */}
        <div className="sp-sidebar__brand">
          <div className="sp-sidebar__brand-icon">
            <MessageCircle size={20} />
          </div>
          <div>
            <p className="sp-sidebar__brand-name">DORA Support</p>
            <span className="sp-sidebar__brand-sub">Trung tâm hỗ trợ</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sp-sidebar__nav">
          <Link href="/" className="sp-sidebar__nav-item">
            <ChevronLeft size={15} />
            Về trang chủ
          </Link>
        </nav>

        {/* Info cards */}
        <div className="sp-sidebar__cards">
          <div className="sp-sidebar__card">
            <Bot size={18} />
            <div>
              <strong>Trợ lý AI</strong>
              <p>Trả lời ngay, 24/7, hiểu sản phẩm DORA</p>
            </div>
          </div>
          <div className="sp-sidebar__card">
            <Headphones size={18} />
            <div>
              <strong>Nhân viên thật</strong>
              <p>Hỗ trợ chuyên sâu theo yêu cầu</p>
            </div>
          </div>
          <div className="sp-sidebar__card">
            <UserRound size={18} />
            <div>
              <strong>Cá nhân hoá</strong>
              <p>Tra cứu đơn hàng và tài khoản của bạn</p>
            </div>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="sp-sidebar__user">
            <div className="sp-sidebar__user-avatar">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
        )}
      </aside>

      {/* ── Chat area ───────────────────────────────────── */}
      <div className="sp-chat">
        {/* Chat header */}
        <div className="sp-chat__header">
          <div className="sp-chat__header-left">
            <div className={`sp-chat__avatar ${isHuman ? "sp-chat__avatar--agent" : ""}`}>
              {isHuman ? <Headphones size={18} /> : <Bot size={18} />}
            </div>
            <div>
              <p className="sp-chat__title">{cfg.label}</p>
              <span className={`sp-chat__sub sp-chat__sub--${status.toLowerCase()}`}>
                {cfg.sub}
              </span>
            </div>
          </div>

          <div className="sp-chat__header-actions">
            {isClosed && (
              <button type="button" className="sp-chat__action-btn" onClick={handleNewChat}>
                <RefreshCw size={14} />
                Cuộc trò chuyện mới
              </button>
            )}
            {!isClosed && isAI && (
              <button
                type="button"
                className="sp-chat__action-btn sp-chat__action-btn--escalate"
                onClick={handleEscalate}
              >
                <Headphones size={14} />
                Kết nối nhân viên
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="sp-chat__body">
          {loading && (
            <div className="sp-chat__loading">
              <div className="sp-chat__loading-dot" />
              <div className="sp-chat__loading-dot" />
              <div className="sp-chat__loading-dot" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="sp-chat__empty">
              <div className="sp-chat__empty-icon"><Bot size={36} /></div>
              <h2>Xin chào{user?.name ? `, ${user.name.split(" ").pop()}` : ""}! 👋</h2>
              <p>Tôi là trợ lý AI của DORA Marketplace. Hỏi tôi về sản phẩm, đơn hàng, chính sách hoặc bất kỳ điều gì bạn cần.</p>
              <div className="sp-chat__suggestions">
                {["Tôi muốn xem sản phẩm mới nhất", "Sản phẩm bán chạy nhất là gì?", "Hướng dẫn mua hàng", "Chính sách hoàn tiền"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="sp-chat__suggestion"
                    onClick={() => { setDraft(s); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`sp-msg sp-msg--${msg.role}`}>
              {msg.role === "system" ? (
                <div className="sp-msg__system">
                  <span>{msg.content}</span>
                </div>
              ) : (
                <>
                  {msg.role !== "user" && (
                    <div className={`sp-msg__avatar sp-msg__avatar--${msg.role}`}>
                      {msg.role === "assistant" ? <Bot size={14} /> : <Headphones size={14} />}
                    </div>
                  )}
                  <div className="sp-msg__bubble">
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

          {/* AI typing */}
          {aiTyping && (
            <div className="sp-msg sp-msg--assistant sp-msg--typing-row">
              <div className="sp-msg__avatar sp-msg__avatar--assistant">
                <Bot size={14} />
              </div>
              <div className="sp-typing-bubble">
                <span className="sp-typing-label">AI đang soạn</span>
                <div className="sp-typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          {/* Agent typing */}
          {agentTyping && !aiTyping && (
            <div className="sp-msg sp-msg--agent sp-msg--typing-row">
              <div className="sp-msg__avatar sp-msg__avatar--agent">
                <Headphones size={14} />
              </div>
              <div className="sp-typing-bubble sp-typing-bubble--agent">
                <span className="sp-typing-label">Nhân viên đang soạn</span>
                <div className="sp-typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          {isPending && (
            <div className="sp-msg__pending">
              <Headphones size={15} />
              Đang kết nối với nhân viên hỗ trợ...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!isClosed ? (
          <form className="sp-chat__input" onSubmit={handleSend}>
            <textarea
              value={draft}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isPending
                  ? "Đang chờ nhân viên kết nối..."
                  : "Nhắn gì đó... (Enter để gửi, Shift+Enter xuống dòng)"
              }
              rows={1}
              disabled={sending || isPending}
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending || isPending}
              aria-label="Gửi"
            >
              <Send size={18} />
            </button>
          </form>
        ) : (
          <div className="sp-chat__closed">
            <p>Cuộc trò chuyện đã kết thúc.</p>
            <button type="button" onClick={handleNewChat}>
              <RefreshCw size={14} />
              Bắt đầu cuộc trò chuyện mới
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
