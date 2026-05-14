"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Bot, Headphones, MessageCircle, Minimize2, Send, UserRound, X } from "lucide-react";
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

export function SupportChatWidget() {
  const { isAuthenticated, apiFetch, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [unread, setUnread] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs để tránh stale closure trong socket handlers
  const ticketRef = useRef<SupportTicket | null>(null);
  const openRef = useRef(false);
  ticketRef.current = ticket;
  openRef.current = open;

  // ── Tạo socket MỘT lần duy nhất khi đăng nhập ──────────────────────────
  // KHÔNG để `open` trong dependency → socket không bị destroy khi đóng/mở
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // Khi socket kết nối hoặc reconnect → rejoin room nếu đang có ticket
    socket.on("connect", () => {
      const t = ticketRef.current;
      if (t) {
        socket.emit("support:join", t.id);
      }
    });

    socket.on("support:message", (msg: SupportMessage) => {
      // Agent typing: tắt khi nhận tin từ agent
      if (msg.role === "agent") setAgentTyping(false);

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!openRef.current) setUnread((n) => n + 1);
    });

    socket.on("support:agent_joined", ({
      systemMessage,
    }: {
      ticket: SupportTicket;
      systemMessage: SupportMessage;
    }) => {
      setTicket((t) => (t ? { ...t, status: "WITH_HUMAN" } : t));
      setMessages((prev) => {
        if (prev.some((m) => m.id === systemMessage.id)) return prev;
        return [...prev, systemMessage];
      });
    });

    socket.on("support:closed", () => {
      setTicket((t) => (t ? { ...t, status: "CLOSED" } : t));
    });

    socket.on("support:user_typing", ({ isTyping }: { userId: number; isTyping: boolean }) => {
      setAgentTyping(isTyping);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]); // ← chỉ phụ thuộc auth, KHÔNG có `open`

  // ── Join room mỗi khi ticket thay đổi ──────────────────────────────────
  useEffect(() => {
    if (!ticket) return;
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      socket.emit("support:join", ticket.id);
    }
    // Nếu chưa connected thì `connect` handler phía trên sẽ tự join
  }, [ticket]);

  // ── Load ticket + messages khi mở lần đầu ──────────────────────────────
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    setUnread(0);

    // Nếu đã có ticket rồi thì không load lại
    if (ticket) return;

    apiFetch<ApiEnvelope<SupportTicket>>("/support/ticket", { notifySuccess: false })
      .then((res) => {
        setTicket(res.data);
        return apiFetch<ApiList<SupportMessage>>(
          `/support/ticket/${res.data.id}/messages?limit=100`,
          { notifySuccess: false }
        );
      })
      .then((res) => setMessages(res.data ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  // ── Auto scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentTyping, aiTyping]);

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
    // Hiện AI typing indicator ngay khi gửi
    if (ticket.status === "AI") setAiTyping(true);
    try {
      await apiFetch(`/support/ticket/${ticket.id}/message`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
        notifySuccess: false,
      });
      // HTTP trả về sau khi server đã emit socket AI message
      // → tắt indicator an toàn tại đây
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

  async function handleClose() {
    if (!ticket) return;
    try {
      await apiFetch(`/support/ticket/${ticket.id}/close`, {
        method: "PATCH",
        notifySuccess: false,
      });
      setOpen(false);
      setMessages([]);
      setTicket(null);
    } catch {}
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  if (!isAuthenticated) return null;

  const isClosed = ticket?.status === "CLOSED";
  const isPending = ticket?.status === "PENDING_HUMAN";
  const isHuman = ticket?.status === "WITH_HUMAN";
  const isAI = !ticket || ticket.status === "AI";

  return (
    <>
      {/* Floating bubble */}
      <button
        type="button"
        className="support-bubble"
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
        aria-label="Hỗ trợ khách hàng"
      >
        <MessageCircle size={22} />
        {unread > 0 && (
          <span className="support-bubble__badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="support-window">
          {/* Header */}
          <div className="support-window__header">
            <div className="support-window__header-left">
              <div className="support-window__avatar">
                {isAI || isPending ? <Bot size={16} /> : <Headphones size={16} />}
              </div>
              <div>
                <p className="support-window__title">
                  {isPending
                    ? "Đang tìm nhân viên..."
                    : isHuman
                    ? "Nhân viên hỗ trợ"
                    : "Trợ lý AI"}
                </p>
                <span
                  className={`support-window__status support-window__status--${
                    ticket?.status?.toLowerCase() ?? "ai"
                  }`}
                >
                  {isPending
                    ? "Đang chờ"
                    : isHuman
                    ? "Đang kết nối"
                    : isClosed
                    ? "Đã đóng"
                    : "Trực tuyến"}
                </span>
              </div>
            </div>
            <div className="support-window__header-actions">
              <button type="button" onClick={() => setOpen(false)} aria-label="Thu nhỏ">
                <Minimize2 size={15} />
              </button>
              {!isClosed && (
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Đóng chat"
                  className="support-window__close-btn"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="support-window__body">
            {messages.length === 0 && (
              <div className="support-window__empty">
                <Bot size={32} />
                <p>Xin chào! Tôi là trợ lý AI của DORA Marketplace.</p>
                <p>Hãy hỏi bất kỳ điều gì bạn cần hỗ trợ.</p>
              </div>
            )}

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
                      <MarkdownMessage
                        content={msg.content}
                        isUser={msg.role === "user"}
                      />
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

            {aiTyping && (
              <div className="support-msg support-msg--assistant support-typing-row">
                <div className="support-msg__avatar support-typing-avatar support-typing-avatar--ai">
                  <Bot size={12} />
                </div>
                <div className="support-typing-bubble">
                  <span className="support-typing-label">AI đang soạn</span>
                  <div className="support-typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            {agentTyping && !aiTyping && (
              <div className="support-msg support-msg--agent support-typing-row">
                <div className="support-msg__avatar support-typing-avatar support-typing-avatar--agent">
                  <Headphones size={12} />
                </div>
                <div className="support-typing-bubble support-typing-bubble--agent">
                  <span className="support-typing-label">Nhân viên đang soạn</span>
                  <div className="support-typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Footer */}
          <div className="support-window__footer">
            {!isClosed && isAI && (
              <button
                type="button"
                className="support-window__escalate-btn"
                onClick={handleEscalate}
              >
                <UserRound size={13} />
                Kết nối nhân viên thật
              </button>
            )}
            {isPending && (
              <p className="support-window__pending-note">
                <Headphones size={13} />
                Đang tìm nhân viên hỗ trợ cho bạn...
              </p>
            )}
            {isClosed && (
              <button
                type="button"
                className="support-window__new-btn"
                onClick={async () => {
                  setMessages([]);
                  setTicket(null);
                  const res = await apiFetch<ApiEnvelope<SupportTicket>>(
                    "/support/ticket",
                    { notifySuccess: false }
                  );
                  setTicket(res.data);
                }}
              >
                Bắt đầu cuộc trò chuyện mới
              </button>
            )}

            {!isClosed && (
              <form className="support-window__input-row" onSubmit={handleSend}>
                <textarea
                  value={draft}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn... (Enter để gửi)"
                  rows={1}
                  disabled={sending || isPending}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending || isPending}
                  aria-label="Gửi"
                >
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
