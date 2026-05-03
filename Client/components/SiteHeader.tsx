import Image from "next/image";
import Link from "next/link";
import { HeaderControls } from "@/components/HeaderControls";

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 w-full z-[70] flex min-h-header items-center justify-between gap-3 border-b border-hairline bg-header-bg px-inline py-[12px] shadow-[0_10px_28px_rgba(0,0,0,0.04)] backdrop-blur-[18px] transition-all duration-fast">
      <Link
        href="/"
        className="brand-link"
        aria-label="DORA MARKETPLACE home"
      >
        <Image
          src="/logo.jpg"
          alt="DORA"
          width={36}
          height={36}
          className="brand-logo hover:rotate-12 transition-transform duration-fast"
          priority
        />
        <span className="brand-title">DORA MARKETPLACE</span>
      </Link>
      <HeaderControls />
    </header>
  );
}
