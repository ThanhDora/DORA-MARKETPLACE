"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { SOCKET_URL, type ApiEnvelope } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { io, type Socket } from "socket.io-client";

type DmMessage = {
  id: number;
  roomId: string;
  senderId: number | null;
  receiverId: number | null;
  content: string;
  createdAt: string;
  sender?: { id: number; name: string } | null;
};

type Props = {
  sellerId: number;
  sellerName: string;
  productName?: string;
};

export function ContactSellerChat({ sellerId, sellerName, productName }: Props) {
  const { user, isAuthenticated, apiFetch, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sellerTyping, setSellerTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomId = user ? `dm-${[user.id, sellerId].sort().join("-")}` : null;

  // Socket
  useEffect(() => {
    if (!accessToken || !roomId) return;
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_room", roomId);
    });

    socket.on("new_message", (msg: DmMessage) => {
      if (msg.roomId !== roomId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    socket.on("user_typing", ({ userId }: { userId: number; roomId: string }) => {
      if (userId === sellerId) {
        setSellerTyping(true);
        setTimeout(() => setSellerTyping(false), 3000);
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [accessToken, roomId, sellerId]);

  // Load lịch sử chat khi mở
  useEffect(() => {
    if (!open || !roomId || loaded) return;
    apiFetch<{ data: DmMessage[] }>(
      `/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`,
      { notifySuccess: false }
    )
      .then((res) => { setMessages(res.data ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [open, roomId, loaded, apiFetch]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sellerTyping]);

  function emitTyping() {
    if (!roomId) return;
    socketRef.current?.emit("typing", { roomId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {}, 2000);
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending || !roomId) return;
    setDraft("");
    setSending(true);
    try {
      await apiFetch<ApiEnvelope<DmMessage>>("/chat/send", {
        method: "POST",
        body: JSON.stringify({ receiverId: sellerId, content: text, roomId }),
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

  if (!isAuthenticated || user?.id === sellerId) return null;

  return (
    <>
      <button
        type="button"
        className="contact-seller-btn"
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={15} />
        Nhắn tin người bán
      </button>

      {open && (
        <div className="contact-seller-modal" role="dialog" aria-modal="true">
          <div className="contact-seller-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="contact-seller-modal__panel">
            {/* Header */}
            <div className="contact-seller-modal__header">
              <div>
                <p className="contact-seller-modal__title">Chat với {sellerName}</p>
                {productName && (
                  <span className="contact-seller-modal__product">Về: {productName}</span>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="contact-seller-modal__body">
              {messages.length === 0 && (
                <div className="contact-seller-modal__empty">
                  <MessageCircle size={28} />
                  <p>Bắt đầu cuộc trò chuyện với người bán</p>
                  {productName && <p className="opacity-60 text-sm">Hỏi về: {productName}</p>}
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`seller-msg-bubble-row ${isMe ? "seller-msg-bubble-row--me" : ""}`}>
                    {!isMe && (
                      <div className="seller-msg-bubble-row__avatar contact-seller-avatar">
                        {sellerName[0]?.toUpperCase()}
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

              {sellerTyping && (
                <div className="seller-msg-bubble-row">
                  <div className="seller-msg-bubble-row__avatar contact-seller-avatar">
                    {sellerName[0]?.toUpperCase()}
                  </div>
                  <div className="seller-msg-bubble support-typing-bubble">
                    <span className="support-typing-label">Đang soạn</span>
                    <div className="support-typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form className="contact-seller-modal__input" onSubmit={handleSend}>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); emitTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder="Nhắn tin cho người bán... (Enter để gửi)"
                rows={2}
                disabled={sending}
                autoFocus
              />
              <button type="submit" disabled={!draft.trim() || sending}>
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
