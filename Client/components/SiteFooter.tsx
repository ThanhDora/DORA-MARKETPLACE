import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BadgeCheck, ShieldCheck, Zap } from "lucide-react";

const FOOTER_LINKS = [
  {
    heading: "Khám phá",
    links: [
      { label: "Marketplace", href: "/catalog" },
      { label: "Tài khoản số", href: "/catalog?type=ACCOUNT" },
      { label: "License & Key", href: "/catalog?type=KEY" },
      { label: "File số", href: "/catalog?type=FILE" },
    ],
  },
  {
    heading: "Bán hàng",
    links: [
      { label: "Trở thành seller", href: "/seller" },
      { label: "Đăng ký tài khoản", href: "/register" },
      { label: "Gói subscription", href: "/seller#plans" },
    ],
  },
  {
    heading: "Tài khoản",
    links: [
      { label: "Đăng nhập", href: "/login" },
      { label: "Đơn hàng của tôi", href: "/account/orders" },
      { label: "Ví web", href: "/account/wallet" },
      { label: "Thông báo", href: "/account/notifications" },
    ],
  },
  {
    heading: "Hỗ trợ",
    links: [
      { label: "Bảo mật giao dịch", href: "/" },
      { label: "Quy trình duyệt hàng", href: "/" },
      { label: "Thanh toán ví web", href: "/" },
    ],
  },
];

const TRUST_BADGES: { icon: ReactNode; label: string }[] = [
  { icon: <Zap size={13} strokeWidth={2} />, label: "Giao nhanh" },
  { icon: <ShieldCheck size={13} strokeWidth={2} />, label: "Thanh toán bảo mật" },
  { icon: <BadgeCheck size={13} strokeWidth={2} />, label: "Hàng đã duyệt" },
  { icon: <Activity size={13} strokeWidth={2} />, label: "Realtime tồn kho" },
];

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Footer">
      {/* Decorative noise overlay */}
      <div className="site-footer__noise" aria-hidden="true" />

      {/* Top glow */}
      <div className="site-footer__glow" aria-hidden="true" />

      <div className="site-footer__inner">
        {/* Brand column */}
        <div className="site-footer__brand">
          <Link href="/" className="site-footer__logo" aria-label="DORA MARKETPLACE trang chủ">
            <span className="site-footer__logo-word">Dora</span>
            <span className="site-footer__logo-market">Marketplace</span>
          </Link>

          <p className="site-footer__tagline">
            Chợ sản phẩm số cho developer, creator và team nhỏ — rõ nguồn, giao nhanh, thanh toán bảo mật.
          </p>

          {/* Trust badges */}
          <ul className="site-footer__badges" aria-label="Cam kết dịch vụ">
            {TRUST_BADGES.map((badge) => (
              <li key={badge.label} className="site-footer__badge">
                <span aria-hidden="true">{badge.icon}</span>
                {badge.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Links grid */}
        <nav className="site-footer__nav" aria-label="Điều hướng footer">
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading} className="site-footer__col">
              <h3 className="site-footer__col-heading">{col.heading}</h3>
              <ul className="site-footer__col-links">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="site-footer__link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Divider */}
      <div className="site-footer__rule" aria-hidden="true" />

      {/* Bottom bar */}
      <div className="site-footer__bottom">
        <p className="site-footer__copy">
          © {currentYear} Dora Marketplace. Nền tảng sản phẩm số.
        </p>
        <div className="site-footer__bottom-links">
          <Link href="/" className="site-footer__fine-link">Điều khoản</Link>
          <span aria-hidden="true">·</span>
          <Link href="/" className="site-footer__fine-link">Bảo mật</Link>
          <span aria-hidden="true">·</span>
          <Link href="/" className="site-footer__fine-link">Cookie</Link>
        </div>
      </div>

      {/* Large background wordmark */}
      <div className="site-footer__wordmark" aria-hidden="true">DORA</div>
    </footer>
  );
}
