"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Bot, Headphones, Send, UserRound } from "lucide-react";
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

const STATUS_LABEL: Record<string, string> = {
  AI: "Đang chat với AI",
  PENDING_HUMAN: "Đang chờ nhân viên...",
  WITH_HUMAN: "Đang chat với nhân viên",
  CLOSED: "Cuộc trò chuyện đã đóng",
};

export function SellerSupportTab() {
  const { apiFetch, accessToken } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticketRef = useRef<SupportTicket | null>(null);
  ticketRef.current = ticket;

  // Socket
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
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    socket.on("support:agent_joined", ({ systemMessage }: { ticket: SupportTicket; systemMessage: SupportMessage }) => {
      setTicket((t) => (t ? { ...t, status: "WITH_HUMAN" } : t));
      setMessages((prev) => (prev.some((m) => m.id === systemMessage.id) ? prev : [...prev, systemMessage]));
    });

    socket.on("support:closed", () => {
      setTicket((t) => (t ? { ...t, status: "CLOSED" } : t));
    });

    socket.on("support:user_typing", ({ isTyping }: { isTyping: boolean }) => {
      setAgentTyping(isTyping);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [accessToken]);

  // Join room khi có ticket
  useEffect(() => {
    if (ticket && socketRef.current?.connected) {
      socketRef.current.emit("support:join", ticket.id);
    }
  }, [ticket]);

  // Load ticket + messages
  useEffect(() => {
    setLoading(true);
    apiFetch<ApiEnvelope<SupportTicket>>("/support/ticket", { notifySuccess: false })
      .then((res) => {
        setTicket(res.data);
        return apiFetch<ApiList<SupportMessage>>(
          `/support/ticket/${res.data.id}/messages?limit=100`,
          { notifySuccess: false }
        );
      })
      .then((res) => setMessages(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiTyping, agentTyping]);

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
      await apiFetch(`/support/ticket/${ticket.id}/escalate`, { method: "POST", notifySuccess: false });
      setTicket((t) => (t ? { ...t, status: "PENDING_HUMAN" } : t));
    } catch {}
  }

  async function handleNew() {
    setMessages([]);
    setTicket(null);
    setLoading(true);
    try {
      const res = await apiFetch<ApiEnvelope<SupportTicket>>("/support/ticket", { notifySuccess: false });
      setTicket(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const isClosed = ticket?.status === "CLOSED";
  const isPending = ticket?.status === "PENDING_HUMAN";
  const isHuman = ticket?.status === "WITH_HUMAN";
  const isAI = !ticket || ticket.status === "AI";

  if (loading) {
    return (
      <section className="seller-support-panel">
        <div className="seller-support-panel__loading">
          <div className="skeleton-panel" style={{ height: 48 }} />
          <div className="skeleton-panel" style={{ height: 300 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="seller-support-panel">
      {/* Header */}
      <div className="seller-support-panel__header">
        <div className="seller-support-panel__header-left">
          <div className={`seller-support-panel__avatar ${isHuman ? "seller-support-panel__avatar--agent" : ""}`}>
            {isHuman ? <Headphones size={16} /> : <Bot size={16} />}
          </div>
          <div>
            <p className="seller-support-panel__title">
              {isPending ? "Đang tìm nhân viên..." : isHuman ? "Nhân viên hỗ trợ" : isClosed ? "Hỗ trợ" : "Trợ lý AI"}
            </p>
            <span className={`seller-support-panel__status seller-support-panel__status--${ticket?.status?.toLowerCase() ?? "ai"}`}>
              {STATUS_LABEL[ticket?.status ?? "AI"]}
            </span>
          </div>
        </div>

        <div className="seller-support-panel__header-right">
          {!isClosed && isAI && (
            <button type="button" className="seller-support-panel__escalate-btn" onClick={handleEscalate}>
              <UserRound size={13} />
              Kết nối nhân viên
            </button>
          )}
          {isClosed && (
            <button type="button" className="seller-support-panel__new-btn" onClick={handleNew}>
              Cuộc trò chuyện mới
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="seller-support-panel__body">
        {messages.length === 0 && (
          <div className="seller-support-panel__empty">
            <Bot size={36} />
            <p>Xin chào! Trợ lý AI DORA sẵn sàng hỗ trợ bạn.</p>
            <p className="text-sm opacity-60">Hỏi về sản phẩm, đơn hàng, chính sách bán hàng...</p>
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
                  <MarkdownMessage content={msg.content} isUser={msg.role === "user"} />
                  <time>
                    {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
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
              <div className="support-typing-dots"><span /><span /><span /></div>
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
              <div className="support-typing-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {isPending && (
          <div className="seller-support-panel__pending">
            <Headphones size={14} />
            Đang kết nối với nhân viên hỗ trợ...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <form className="seller-support-panel__input" onSubmit={handleSend}>
          <textarea
            value={draft}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPending ? "Đang chờ nhân viên..." : "Nhập câu hỏi... (Enter để gửi)"}
            rows={2}
            disabled={sending || isPending}
          />
          <button type="submit" disabled={!draft.trim() || sending || isPending}>
            <Send size={16} />
            Gửi
          </button>
        </form>
      )}
    </section>
  );
}
