"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HeaderControls } from "@/components/HeaderControls";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      ref={headerRef}
      className="site-header fixed top-0 left-0 w-full z-[70] flex min-h-header items-center justify-between gap-3 border-b border-hairline bg-header-bg px-inline py-0"
    >
      <Link href="/" className="brand-link" aria-label="DORA MARKETPLACE home">
        <span className="brand-title">DORA MARKETPLACE</span>
      </Link>
      <HeaderControls />
    </header>
  );
}
