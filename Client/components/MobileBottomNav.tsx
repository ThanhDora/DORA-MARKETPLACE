"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, UserCircle } from "lucide-react";

const navItems = [
  { href: "/", label: "Trang chủ", Icon: Home },
  { href: "/catalog", label: "Tìm kiếm", Icon: Search },
  { href: "/cart", label: "Giỏ hàng", Icon: ShoppingCart },
  { href: "/account", label: "Tài khoản", Icon: UserCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "mobile-bottom-nav__item is-active text-on-accent bg-tertiary border-tertiary" : "mobile-bottom-nav__item"}
            aria-current={isActive ? "page" : undefined}
          >
            <item.Icon size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
