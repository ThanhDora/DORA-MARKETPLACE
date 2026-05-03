import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  LockKeyhole,
  Sparkles,
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
        <section className="grid md:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)] gap-[clamp(34px,5vw,64px)] items-center min-h-[calc(100svh-var(--header-height))] py-[clamp(58px,8vw,92px)] px-inline">
          <div className="max-w-[720px]">
            <p className="hero-kicker">
              <span>Chợ sản phẩm số</span>
              <span className="hero-kicker__realtime">
                <span className="hero-kicker__dot" aria-hidden="true" />
                sẵn sàng realtime
              </span>
            </p>
            <h1 className="hero-headline">
              <span className="hero-headline__main">Mua tài khoản, key, file số</span>
              <span className="hero-headline__sub">an toàn và minh bạch.</span>
            </h1>
            <p>
              DORA MARKETPLACE gom sản phẩm số đã duyệt, thông tin minh bạch, seller có danh tính
              và quy trình thanh toán được bảo vệ bằng JWT, rate limit và cookie HttpOnly.
            </p>
            <SearchInput />
            <div className="flex flex-wrap gap-[14px] mt-7">
              <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
                Xem marketplace
                <ArrowRight size={17} />
              </Link>
              <Link href="/seller" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface">
                Bán sản phẩm
              </Link>
            </div>
          </div>

          <RealtimeHomeLeaderboard initialProducts={products} />
        </section>

        <RealtimeFeaturedProductsSection initialProducts={products} />

        <section className="px-inline py-block">
          <div className="grid justify-items-start mb-[34px] grid grid-cols-[minmax(0,1fr)_auto] gap-5 items-end">
            <div>
              <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Danh mục</p>
              <h2>Đi thẳng đến loại sản phẩm cần mua</h2>
            </div>
            <Link href="/catalog" className="inline-flex min-h-[40px] items-center text-secondary text-sm font-bold hover:text-primary">
              Xem tất cả
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-[var(--grid-gap)]">
            {categories.slice(0, 6).map((category) => (
              <Link key={category.id} href={`/catalog?categoryId=${category.id}`} className="category-card">
                <span>
                  <Sparkles size={18} />
                </span>
                <strong>{category.name}</strong>
                <small>{category._count?.products ?? 0} sản phẩm</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-block bg-surface px-inline commerce-process">
          <div className="grid justify-items-start mb-[34px] grid grid-cols-[minmax(0,1fr)_auto] gap-5 items-end">
            <div>
              <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Bảo mật và vận hành</p>
              <h2>Flow mua bán rõ ràng cho cả buyer, seller và admin</h2>
            </div>
            <Link href="/register" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
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
