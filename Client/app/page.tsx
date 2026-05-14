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
                Chợ sản phẩm số &middot; Trực Tuyến
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

        <section className="cat-v3 px-inline py-block">
          <div className="cat-v3__head">
            <span className="cat-v3__label">Danh mục</span>
            <Link href="/catalog" className="cat-v3__see-all">
              Xem tất cả <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="cat-v3__list">
            {categories.slice(0, 6).map((category, i) => (
              <Link
                key={category.id}
                href={`/catalog?categoryId=${category.id}`}
                className="cat-v3__item"
                style={{ "--cat-i": i } as React.CSSProperties}
              >
                <span className="cat-v3__index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="cat-v3__name">{category.name}</span>
                <span className="cat-v3__count">{category._count?.products ?? 0} sp</span>
                <span className="cat-v3__arrow" aria-hidden="true">→</span>
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
