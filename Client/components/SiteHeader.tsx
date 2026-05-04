import Link from "next/link";
import { HeaderControls } from "@/components/HeaderControls";

export function SiteHeader() {
  return (
    <header className="site-header fixed top-0 left-0 w-full z-[70] flex min-h-header items-center justify-between gap-3 border-b border-hairline bg-header-bg px-inline py-0 transition-colors duration-fast">
      <Link
        href="/"
        className="brand-link"
        aria-label="DORA MARKETPLACE home"
      >
        <span className="brand-title">DORA MARKETPLACE</span>
      </Link>
      <HeaderControls />
    </header>
  );
}
