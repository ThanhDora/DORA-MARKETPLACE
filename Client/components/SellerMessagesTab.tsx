"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Inbox, MessageCircle, Send } from "lucide-react";
import { SOCKET_URL, type ApiEnvelope } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { io, type Socket } from "socket.io-client";

type UserInfo = { id: number; name: string; avatar?: string | null; email?: string };

type DmMessage = {
  id: number;
  roomId: string;
  senderId: number | null;
  receiverId: number | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: UserInfo | null;
  receiver?: UserInfo | null;
};

type InboxItem = {
  roomId: string;
  lastMessage: DmMessage;
  otherUser: UserInfo | null;
  unreadCount: number;
};

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function SellerMessagesTab() {
  const { user, apiFetch, accessToken } = useAuth();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<InboxItem | null>(null);
  selectedRef.current = selected;

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
      const cur = selectedRef.current;
      if (cur) socket.emit("join_room", cur.roomId);
    });

    socket.on("new_message", (msg: DmMessage) => {
      if (msg.roomId === selectedRef.current?.roomId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      setInbox((prev) =>
        prev.map((item) =>
          item.roomId === msg.roomId
            ? {
                ...item,
                lastMessage: msg,
                unreadCount:
                  item.roomId === selectedRef.current?.roomId
                    ? 0
                    : item.unreadCount + (msg.senderId !== user?.id ? 1 : 0),
              }
            : item
        )
      );
    });

    socket.on("user_typing", ({ userId, roomId }: { userId: number; roomId: string }) => {
      if (roomId === selectedRef.current?.roomId && userId !== user?.id) {
        setOtherTyping(true);
        setTimeout(() => setOtherTyping(false), 3000);
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [accessToken, user?.id]);

  // Join room khi chọn conversation
  useEffect(() => {
    if (selected && socketRef.current?.connected) {
      socketRef.current.emit("join_room", selected.roomId);
    }
  }, [selected]);

  // Load inbox
  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ApiEnvelope<InboxItem[]>>("/chat/seller/inbox", { notifySuccess: false });
      setInbox(res.data ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void loadInbox(); }, [loadInbox]);

  // Load messages khi chọn conversation
  async function selectConversation(item: InboxItem) {
    setSelected(item);
    setMessages([]);
    setInbox((prev) => prev.map((i) => i.roomId === item.roomId ? { ...i, unreadCount: 0 } : i));
    try {
      const res = await apiFetch<{ data: DmMessage[] }>(
        `/chat/rooms/${encodeURIComponent(item.roomId)}/messages?limit=100`,
        { notifySuccess: false }
      );
      setMessages(res.data ?? []);
    } catch {}
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  function emitTyping() {
    if (!selected) return;
    socketRef.current?.emit("typing", { roomId: selected.roomId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {}, 2000);
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setDraft("");
    setSending(true);
    try {
      await apiFetch<ApiEnvelope<DmMessage>>("/chat/send", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selected.otherUser?.id,
          content: text,
          roomId: selected.roomId,
        }),
        notifySuccess: false,
      });
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  const totalUnread = inbox.reduce((s, i) => s + i.unreadCount, 0);

  return (
    <div className="seller-msg-page">
      {/* Sidebar */}
      <aside className="seller-msg-sidebar">
        <div className="seller-msg-sidebar__head">
          <h2>
            Tin nhắn từ khách
            {totalUnread > 0 && <span className="seller-msg-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </h2>
          <p>{inbox.length} hội thoại</p>
        </div>

        <div className="seller-msg-sidebar__list">
          {loading && (
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((n) => <div key={n} className="skeleton-panel" style={{ height: 60 }} />)}
            </div>
          )}

          {!loading && inbox.length === 0 && (
            <div className="seller-msg-sidebar__empty">
              <Inbox size={28} />
              <p>Chưa có tin nhắn nào từ khách hàng</p>
            </div>
          )}

          {inbox.map((item) => (
            <button
              key={item.roomId}
              type="button"
              className={[
                "seller-msg-conv",
                selected?.roomId === item.roomId ? "seller-msg-conv--active" : "",
                item.unreadCount > 0 ? "seller-msg-conv--unread" : "",
              ].join(" ")}
              onClick={() => selectConversation(item)}
            >
              <div className="seller-msg-conv__avatar">
                {initials(item.otherUser?.name)}
              </div>
              <div className="seller-msg-conv__body">
                <div className="seller-msg-conv__top">
                  <span className="seller-msg-conv__name">{item.otherUser?.name ?? "Khách"}</span>
                  {item.unreadCount > 0 && (
                    <span className="seller-msg-conv__unread">{item.unreadCount > 9 ? "9+" : item.unreadCount}</span>
                  )}
                </div>
                <p className="seller-msg-conv__preview">
                  {item.lastMessage.senderId === user?.id ? "Bạn: " : ""}
                  {item.lastMessage.content}
                </p>
                <time className="seller-msg-conv__time">
                  {new Date(item.lastMessage.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <section className="seller-msg-main">
        {!selected ? (
          <div className="seller-msg-main__placeholder">
            <MessageCircle size={48} />
            <h3>Chọn hội thoại</h3>
            <p>Chọn một tin nhắn từ khách hàng để bắt đầu phản hồi</p>
          </div>
        ) : (
          <>
            <div className="seller-msg-main__header">
              <div className="seller-msg-conv__avatar seller-msg-conv__avatar--lg">
                {initials(selected.otherUser?.name)}
              </div>
              <div>
                <strong>{selected.otherUser?.name ?? "Khách hàng"}</strong>
                <span>{selected.otherUser?.email ?? ""}</span>
              </div>
            </div>

            <div className="seller-msg-main__body">
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`seller-msg-bubble-row ${isMe ? "seller-msg-bubble-row--me" : ""}`}>
                    {!isMe && (
                      <div className="seller-msg-bubble-row__avatar">
                        {initials(msg.sender?.name)}
                      </div>
                    )}
                    <div className={`seller-msg-bubble ${isMe ? "seller-msg-bubble--me" : ""}`}>
                      <MarkdownMessage content={msg.content} isUser={isMe} />
                      <time>
                        {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                  </div>
                );
              })}

              {otherTyping && (
                <div className="seller-msg-bubble-row">
                  <div className="seller-msg-bubble-row__avatar">{initials(selected.otherUser?.name)}</div>
                  <div className="seller-msg-bubble support-typing-bubble">
                    <span className="support-typing-label">Đang soạn</span>
                    <div className="support-typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form className="seller-msg-main__input" onSubmit={handleSend}>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); emitTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder="Trả lời khách hàng... (Enter để gửi)"
                rows={2}
                disabled={sending}
              />
              <button type="submit" disabled={!draft.trim() || sending}>
                <Send size={16} />
                Gửi
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
