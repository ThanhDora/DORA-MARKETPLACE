import type React from "react";
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
        <section className="hero px-inline">
          <div className="hero__body">
            <div className="hero__copy">
              <p className="hero__kicker">
                <span className="hero__kicker-ornament" aria-hidden="true">✦</span>
                Chợ sản phẩm số &middot; realtime
              </p>
              <h1 className="hero__title">
                <span className="hero__title-em">Marketplace</span>
                <span className="hero__title-sub">Sản phẩm số &mdash; rõ nguồn, giao nhanh</span>
              </h1>
              <div className="hero__rule" aria-hidden="true">
                <span className="hero__rule-line" />
                <span className="hero__rule-dot">✦</span>
                <span className="hero__rule-line" />
              </div>
              <p className="hero__desc">
                Tài khoản, license, API key và file số đã duyệt với tồn kho rõ ràng,
                seller có danh tính và quy trình thanh toán được bảo vệ.
              </p>
              <SearchInput />
              <div className="hero__actions">
                <Link href="/catalog" className="hero__btn hero__btn--primary">
                  Xem marketplace
                  <ArrowRight size={17} />
                </Link>
                <Link href="/seller" className="hero__btn hero__btn--ghost">
                  Bán sản phẩm
                </Link>
              </div>
            </div>

          <RealtimeHomeLeaderboard initialProducts={products} />
          </div>
        </section>

        <RealtimeFeaturedProductsSection initialProducts={products} />

        <section className="cat-section px-inline py-block">
          <div className="cat-section__head">
            <span className="cat-section__label">Danh mục</span>
            <h2 className="cat-section__title">Đi thẳng đến<br />loại sản phẩm cần mua</h2>
            <Link href="/catalog" className="cat-section__all">
              Xem tất cả <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="cat-grid">
            {categories.slice(0, 6).map((category, i) => (
              <Link
                key={category.id}
                href={`/catalog?categoryId=${category.id}`}
                className="cat-card"
                data-idx={i}
                style={{ "--cat-i": i } as React.CSSProperties}
              >
                <span className="cat-card__num">0{i + 1}</span>
                <span className="cat-card__ordinal" aria-hidden="true">0{i + 1}</span>
                {category.icon ? (
                  <span className="cat-card__icon" aria-hidden="true">{category.icon}</span>
                ) : null}
                <div className="cat-card__body">
                  <strong className="cat-card__name">{category.name}</strong>
                  <span className="cat-card__count">{category._count?.products ?? 0} sản phẩm</span>
                </div>
                <span className="cat-card__arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="ops-section">
          <div className="ops-section__inner px-inline">
            <div className="ops-section__top">
              <div>
                <span className="ops-section__label">Tại sao chọn chúng tôi</span>
                <h2 className="ops-section__heading">
                  Mua bán an toàn,<br />
                  rõ ràng từ đầu đến cuối
                </h2>
              </div>
              <Link href="/register" className="ops-cta">
                Bắt đầu ngay <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="ops-grid">
              <article className="ops-step">
                <div className="ops-step__num" aria-hidden="true">01</div>
                <div className="ops-step__icon"><BadgeCheck size={22} /></div>
                <h3 className="ops-step__title">Hàng đã kiểm duyệt</h3>
                <p className="ops-step__desc">
                  Mỗi sản phẩm đều qua xét duyệt trước khi lên sàn. Bạn luôn mua đúng thứ được mô tả, từ người bán có danh tính rõ ràng.
                </p>
              </article>

              <article className="ops-step">
                <div className="ops-step__num" aria-hidden="true">02</div>
                <div className="ops-step__icon"><LockKeyhole size={22} /></div>
                <h3 className="ops-step__title">Thanh toán được bảo vệ</h3>
                <p className="ops-step__desc">
                  Tiền giữ trong ví nội bộ cho đến khi đơn hoàn tất. Không lộ thông tin thẻ, không rủi ro khi giao dịch.
                </p>
              </article>

              <article className="ops-step">
                <div className="ops-step__num" aria-hidden="true">03</div>
                <div className="ops-step__icon"><Zap size={22} /></div>
                <h3 className="ops-step__title">Cập nhật tức thì</h3>
                <p className="ops-step__desc">
                  Tồn kho và trạng thái đơn hàng thay đổi ngay lập tức. Bạn biết chính xác sản phẩm còn hay hết, đơn đang ở bước nào.
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
