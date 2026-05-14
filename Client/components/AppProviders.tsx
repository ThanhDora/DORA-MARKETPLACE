"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { SupportChatWidget } from "@/components/SupportChatWidget";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          {children}
          <SupportChatWidget />
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
