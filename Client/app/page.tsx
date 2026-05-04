import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  LockKeyhole,
  Zap,
} from "lucide-react";
import {
  RealtimeFeaturedProductsSection,
  RealtimeHomeLeaderboard,
} from "@/components/RealtimeHomeProductSections";
import { SearchInput } from "@/components/SearchInput";
import { getCategories, getProducts } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  const [{ products }, categories] = await Promise.all([
    getProducts({ limit: 8, sortBy: "soldCount", sortOrder: "desc" }),
    getCategories(),
  ]);

  return (
    <>
      <main className="home-no-select">
        <section className="anthro-hero px-inline">
          <div className="anthro-hero__copy">
            <p className="hero-kicker">
              <span>Chợ sản phẩm số</span>
              <span className="hero-kicker__realtime">
                <span className="hero-kicker__dot" aria-hidden="true" />
                sẵn sàng realtime
              </span>
            </p>
            <h1 className="hero-headline">
              <span className="hero-headline__lead">Marketplace cho sản phẩm số</span>
              <span className="hero-headline__underlined">rõ nguồn, giao nhanh.</span>
            </h1>
            <p className="hero-intro">
              DORA MARKETPLACE gom tài khoản, license, API key và file số đã duyệt với tồn kho rõ,
              seller có danh tính và quy trình thanh toán được bảo vệ.
            </p>
            <SearchInput />
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/catalog" className="anthro-button anthro-button--primary">
                Xem marketplace
                <ArrowRight size={17} />
              </Link>
              <Link href="/seller" className="anthro-button anthro-button--ghost">
                Bán sản phẩm
              </Link>
            </div>
          </div>

          <RealtimeHomeLeaderboard initialProducts={products} />
        </section>

        <RealtimeFeaturedProductsSection initialProducts={products} />

        <section className="px-inline py-block">
          <div className="anthro-section-head">
            <div>
              <p>Danh mục</p>
              <h2>Đi thẳng đến loại sản phẩm cần mua</h2>
            </div>
            <Link href="/catalog" className="anthro-text-link">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-[var(--grid-gap)]">
            {categories.slice(0, 6).map((category) => (
              <Link key={category.id} href={`/catalog?categoryId=${category.id}`} className="category-card">
                <strong>{category.name}</strong>
                <small>{category._count?.products ?? 0} sản phẩm</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-block px-inline commerce-process">
          <div className="anthro-section-head">
            <div>
              <p>Bảo mật và vận hành</p>
              <h2>Flow mua bán rõ ràng cho cả buyer, seller và admin</h2>
            </div>
            <Link href="/register" className="anthro-button anthro-button--primary">
              Tạo tài khoản
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[clamp(26px,4vw,44px)]">
            <article>
              <span>
                <BadgeCheck size={18} />
                01
              </span>
              <h3>Sản phẩm được duyệt</h3>
              <p>Người bán đăng hàng, admin duyệt, người mua chỉ thấy sản phẩm ĐÃ DUYỆT trên marketplace.</p>
            </article>
            <article>
              <span>
                <LockKeyhole size={18} />
                02
              </span>
              <h3>Token ngắn hạn</h3>
              <p>Access token chỉ nằm trong bộ nhớ; refresh token nằm trong HttpOnly cookie của backend.</p>
            </article>
            <article>
              <span>
                <Zap size={18} />
                03
              </span>
              <h3>Sẵn sàng realtime</h3>
              <p>UI đã có Socket.IO provider và polling dự phòng cho tồn kho/đơn hàng trong khi backend realtime cho giai đoạn sau.</p>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
