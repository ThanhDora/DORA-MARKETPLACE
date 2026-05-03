"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { APP_TOAST_EVENT } from "@/lib/api";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  text: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (text: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((text: string, type: ToastType = "error") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: unknown; type?: unknown }>).detail;
      if (!detail || typeof detail.text !== "string") return;
      const type: ToastType =
        detail.type === "success" || detail.type === "error" || detail.type === "info"
          ? detail.type
          : "info";
      showToast(detail.text, type);
    };

    window.addEventListener(APP_TOAST_EVENT, handler);
    return () => window.removeEventListener(APP_TOAST_EVENT, handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-[calc(var(--header-height)+14px)] right-4 z-50 grid gap-2 max-w-[400px] w-[calc(100vw-32px)] pointer-events-none" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertCircle : Info;

  return (
    <div
      className={`toast-alert toast-alert--${toast.type}`}
      role="alert"
    >
      <span className="toast-alert__icon">
        <Icon size={16} />
      </span>
      <div className="toast-alert__content">
        <p>{toast.text}</p>
      </div>
      <button type="button" className="toast-alert__close" onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo">
        <X size={14} />
      </button>
      <span className="toast-alert__progress" />
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
