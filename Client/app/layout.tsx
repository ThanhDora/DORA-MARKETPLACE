import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/AppProviders";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SWRegister } from "@/components/SWRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dora-marketplace.local"),
  title: {
    default: "DORA MARKETPLACE | Chợ sản phẩm số",
    template: "%s | DORA MARKETPLACE",
  },
  description:
    "DORA MARKETPLACE là chợ sản phẩm số cho tài khoản, API key, license và file số với thanh toán bảo mật, tồn kho rõ ràng và bảng điều khiển realtime.",
  icons: {
    icon: "/logo-small.png",
    apple: "/logo-small.png",
  },
  openGraph: {
    title: "DORA MARKETPLACE",
    description: "Chợ sản phẩm số giao nhanh cho developer, creator và team nhỏ.",
    url: "https://dora-marketplace.local",
    siteName: "DORA MARKETPLACE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf9f5",
};

const themeScript = `
(() => {
  try {
    const storageKey = "dora-marketplace-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProviders>
          <SiteHeader />
          {children}
          <MobileBottomNav />
          <SWRegister />
        </AppProviders>
      </body>
    </html>
  );
}
