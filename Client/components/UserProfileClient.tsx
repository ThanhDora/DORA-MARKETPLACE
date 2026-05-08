"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  ShieldCheck,
  Store,
  UserRound,
  ArrowLeft,
  Pencil,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/components/AuthProvider";
import {
  API_BASE_URL,
  normalizeProduct,
  type BackendProduct,
  type StoreProduct,
} from "@/lib/api";

type PublicUser = {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  address?: string | null;
  role: string;
  createdAt: string;
  _count: { products: number; orders: number };
};

type ProductFilter = "ALL" | "ACCOUNT" | "KEY" | "FILE";

const FILTERS: { key: ProductFilter; label: string }[] = [
  { key: "ALL",     label: "Tất cả"    },
  { key: "ACCOUNT", label: "Tài khoản" },
  { key: "KEY",     label: "Key"       },
  { key: "FILE",    label: "File"      },
];

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function resolveAvatar(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  try {
    const origin = new URL(API_BASE_URL).origin;
    if (raw.startsWith("/api/")) return `${origin}${raw}`;
    if (raw.startsWith("/uploads/")) return `${origin}/api${raw}`;
  } catch {}
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function getRoleConfig(role: string) {
  if (role === "ADMIN")  return { label: "Quản trị viên", short: "ADMIN",  Icon: ShieldCheck, cls: "admin"  };
  if (role === "SELLER") return { label: "Người bán",     short: "SELLER", Icon: Store,       cls: "seller" };
  return                        { label: "Người mua",     short: "MEMBER", Icon: UserRound,   cls: "user"   };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

function fmtJoinedShort(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Pagination = { page: number; limit: number; total: number };

type Props = {
  user: PublicUser;
  initialProducts: StoreProduct[];
  initialPagination: Pagination;
};

const PAGE_SIZE = 12;

function getPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  if (current > 3) items.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    items.push(i);
  }
  if (current < total - 2) items.push("…");
  items.push(total);
  return items;
}

export function UserProfileClient({ user, initialProducts, initialPagination }: Props) {
  const { user: me } = useAuth();
  const [filter,     setFilter]     = useState<ProductFilter>("ALL");
  const [page,       setPage]       = useState(1);
  const [products,   setProducts]   = useState<StoreProduct[]>(initialProducts);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading,    setLoading]    = useState(false);
  const [imgErr,     setImgErr]     = useState(false);
  const [typeCounts, setTypeCounts] = useState<Record<ProductFilter, number | null>>({
    ALL:     initialPagination.total,
    ACCOUNT: null,
    KEY:     null,
    FILE:    null,
  });

  const skipFirstFetch = useRef(true);
  const catalogRef     = useRef<HTMLElement | null>(null);

  const isSelf    = me?.id === user.id;
  const avatarSrc = imgErr ? null : resolveAvatar(user.avatar);
  const role      = getRoleConfig(user.role);
  const { Icon }  = role;
  const isSeller  = user.role === "SELLER" || user.role === "ADMIN";

  const sold    = initialProducts.reduce((s, p) => s + (p.soldCount ?? 0), 0);
  const avgRate = initialProducts.length > 0
    ? (initialProducts.reduce((s, p) => s + (p.rating ?? 0), 0) / initialProducts.length).toFixed(1)
    : null;

  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));
  const showFrom   = pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo     = Math.min(page * PAGE_SIZE, pagination.total);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
    });
    if (filter !== "ALL") params.set("type", filter);

    fetch(`${API_BASE_URL}/users/${user.id}/products?${params.toString()}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        const list = (Array.isArray(j.data) ? j.data as BackendProduct[] : []).map(normalizeProduct);
        const pg: Pagination = j.pagination ?? { page, limit: PAGE_SIZE, total: list.length };
        setProducts(list);
        setPagination(pg);
        setTypeCounts(prev => ({ ...prev, [filter]: pg.total }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filter, page, user.id]);

  const handleFilter = (k: ProductFilter) => {
    if (k === filter) return;
    setFilter(k);
    setPage(1);
  };

  const handlePage = (next: number) => {
    if (next < 1 || next > totalPages || next === page || loading) return;
    setPage(next);
    if (catalogRef.current) {
      const top = catalogRef.current.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const issueId = String(user.id).padStart(4, "0");
  const pageItems = getPageItems(page, totalPages);

  return (
    <div className="prf">

      {/* ── Top masthead: nav row ── */}
      <nav className="prf__nav">
        <Link href="/catalog" className="prf__nav-btn">
          <ArrowLeft size={14} strokeWidth={2.2} />
          <span>Sàn giao dịch</span>
        </Link>
        <span className="prf__nav-meta">
          DORA · MEMBER PROFILE · NO.{issueId}
        </span>
        {isSelf ? (
          <Link href="/account" className="prf__nav-btn prf__nav-btn--cta">
            <Pencil size={12} strokeWidth={2.2} />
            <span>Chỉnh sửa hồ sơ</span>
          </Link>
        ) : (
          <span className="prf__nav-btn prf__nav-btn--ghost" aria-hidden="true">
            <span>{role.short}</span>
          </span>
        )}
      </nav>

      {/* ── Hero: editorial masthead ── */}
      <section className="prf__hero">
        <span className="prf__kicker">
          PROFILE / {role.short} / {fmtJoinedShort(user.createdAt)}
        </span>

        <div className="prf__hero-grid">
          <div className={`prf__avatar prf__avatar--${role.cls}`}>
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={user.name}
                className="prf__avatar-img"
                onError={() => setImgErr(true)}
              />
            ) : (
              <span className="prf__avatar-txt">{getInitials(user.name)}</span>
            )}
            <span className="prf__avatar-tag">PORTRAIT</span>
          </div>

          <div className="prf__identity">
            <h1 className="prf__name">{user.name}</h1>

            <p className="prf__lede">
              <span className="prf__lede-emph">{role.label}</span>{" "}
              trên DORA Marketplace, gia nhập từ {fmtDate(user.createdAt)}.
            </p>

            {user.bio && <p className="prf__bio">{user.bio}</p>}

            <dl className="prf__meta">
              <div className="prf__meta-cell">
                <dt className="prf__mono">JOINED</dt>
                <dd className="prf__meta-val">
                  <CalendarDays size={13} strokeWidth={2} />
                  {fmtDate(user.createdAt)}
                </dd>
              </div>
              <div className="prf__meta-cell">
                <dt className="prf__mono">ROLE</dt>
                <dd className="prf__meta-val">
                  <Icon size={13} strokeWidth={2} />
                  {role.label}
                </dd>
              </div>
              {user.address && (
                <div className="prf__meta-cell">
                  <dt className="prf__mono">LOCATION</dt>
                  <dd className="prf__meta-val">
                    <MapPin size={13} strokeWidth={2} />
                    {user.address}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Stats: dark editorial band ── */}
      <section className="prf__stats">
        <div className="prf__stat">
          <span className="prf__mono prf__mono--inv">SẢN PHẨM ĐĂNG</span>
          <span className="prf__stat-num">{user._count.products}</span>
          <span className="prf__stat-sub">tổng kho hiện tại</span>
        </div>
        <div className="prf__stat">
          <span className="prf__mono prf__mono--inv">ĐÃ BÁN</span>
          <span className="prf__stat-num">{sold}</span>
          <span className="prf__stat-sub">đơn hoàn tất</span>
        </div>
        <div className="prf__stat">
          <span className="prf__mono prf__mono--inv">ĐÁNH GIÁ</span>
          <span className="prf__stat-num">
            {avgRate ?? "—"}
            {avgRate && <span className="prf__stat-suffix"> / 5</span>}
          </span>
          <span className="prf__stat-sub">trung bình từ người mua</span>
        </div>
      </section>

      {/* ── Catalog ── */}
      {isSeller ? (
        <section className="prf__catalog" ref={catalogRef}>
          <div className="prf__cat-head">
            <div className="prf__cat-titles">
              <span className="prf__mono">
                CỬA HÀNG · {pagination.total} ẤN PHẨM
              </span>
              <h2 className="prf__cat-title">Danh mục sản phẩm</h2>
            </div>
            <div className="prf__tabs" role="tablist">
              {FILTERS.map(({ key, label }) => {
                const n = typeCounts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    className={`prf__tab${filter === key ? " is-on" : ""}`}
                    onClick={() => handleFilter(key)}
                  >
                    <span>{label}</span>
                    <span className="prf__tab-n">{n ?? "·"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="prf__catalog-body">
            {loading ? (
              <div className="prf__grid prf__grid--skel" key={`skel-${filter}-${page}`} aria-busy="true" aria-live="polite">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div
                    key={i}
                    className="prf__skel"
                    style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties}
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="prf__state" key={`empty-${filter}`}>
                <Search size={32} strokeWidth={1.2} />
                <p className="prf__state-title">Chưa có sản phẩm</p>
                <p className="prf__state-sub">
                  {filter !== "ALL"
                    ? "Chưa có sản phẩm thuộc loại này trong cửa hàng."
                    : "Người bán chưa đăng ấn phẩm nào lên sàn."}
                </p>
              </div>
            ) : (
              <div className="prf__grid prf__grid--in" key={`grid-${filter}-${page}`}>
                {products.map(p => (
                  <div key={p.id} className="prf__grid-cell">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="prf__pagi" role="navigation" aria-label="Phân trang sản phẩm">
              <span className="prf__pagi-meta">
                HIỂN THỊ {showFrom}–{showTo} / {pagination.total}
              </span>

              <div className="prf__pagi-controls">
                <button
                  type="button"
                  className="prf__pagi-btn prf__pagi-btn--nav"
                  onClick={() => handlePage(page - 1)}
                  disabled={page <= 1 || loading}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={14} strokeWidth={2.2} />
                  <span className="prf__pagi-btn-label">Trước</span>
                </button>

                {pageItems.map((it, idx) =>
                  it === "…" ? (
                    <span key={`e${idx}`} className="prf__pagi-ell" aria-hidden="true">…</span>
                  ) : (
                    <button
                      key={it}
                      type="button"
                      className={`prf__pagi-btn${it === page ? " is-on" : ""}`}
                      onClick={() => handlePage(it)}
                      disabled={loading}
                      aria-current={it === page ? "page" : undefined}
                      aria-label={`Trang ${it}`}
                    >
                      {it}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="prf__pagi-btn prf__pagi-btn--nav"
                  onClick={() => handlePage(page + 1)}
                  disabled={page >= totalPages || loading}
                  aria-label="Trang sau"
                >
                  <span className="prf__pagi-btn-label">Sau</span>
                  <ChevronRight size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="prf__feature" aria-labelledby="prf-feature-h">
          <div className="prf__feature-body">
            <span className="prf__mono prf__mono--inv">CHƯA MỞ CỬA HÀNG</span>
            <h2 id="prf-feature-h" className="prf__feature-headline">
              Tài khoản này chưa mở <em>cửa hàng</em> trên DORA.
            </h2>
            <p className="prf__feature-sub">
              Hồ sơ này thuộc về một người mua. Hãy khám phá hàng nghìn ấn phẩm số khác từ
              những người bán đã được xác minh trên sàn giao dịch.
            </p>
            <Link href="/catalog" className="prf__feature-cta">
              <span>Khám phá sàn giao dịch</span>
              <ArrowRight size={14} strokeWidth={2.2} />
            </Link>
          </div>
          <div className="prf__feature-mark" aria-hidden="true">
            <span className="prf__feature-mark-num">{role.short}</span>
            <span className="prf__feature-mark-sub">DORA · {issueId}</span>
          </div>
        </section>
      )}
    </div>
  );
}
