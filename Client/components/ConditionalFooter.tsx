"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";

const NO_FOOTER_PATHS = ["/admin/support", "/support"];

export function ConditionalFooter() {
  const pathname = usePathname();
  if (NO_FOOTER_PATHS.some((p) => pathname.startsWith(p))) return null;
  return <SiteFooter />;
}
