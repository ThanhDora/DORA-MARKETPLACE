import type { Metadata } from "next";
import Link from "next/link";
import { RealtimeCatalogGrid } from "@/components/RealtimeCatalogGrid";
import { SearchInput } from "@/components/SearchInput";
import { getCategories, getProducts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Sản phẩm",
  description: "Tìm tài khoản, key và file số trên DORA MARKETPLACE.",
};

export const revalidate = 60;
const PRODUCTS_PER_PAGE = 20;

type CatalogPageProps = {
  searchParams?: Promise<{
    search?: string;
    categoryId?: string;
    type?: string;
    page?: string;
  }>;
};

function buildCatalogPageHref({
  search,
  categoryId,
  type,
  page,
}: {
  search?: string;
  categoryId?: string;
  type?: string;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (categoryId) query.set("categoryId", categoryId);
  if (type) query.set("type", type);
  if (page && page > 1) query.set("page", String(page));
  const serialized = query.toString();
  return serialized ? `/catalog?${serialized}` : "/catalog";
}

function buildCatalogHref(search?: string, categoryId?: string, type?: string) {
  return buildCatalogPageHref({ search, categoryId, type });
}

function getSafePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  const items = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...items].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

const TYPE_FILTERS = [
  { label: "Tất cả", value: undefined },
  { label: "Tài khoản", value: "ACCOUNT" },
  { label: "Key", value: "KEY" },
  { label: "File", value: "FILE" },
] as const;

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedCategoryId = params?.categoryId;
  const selectedType = params?.type;
  const currentPage = getSafePage(params?.page);

  const [{ products, pagination, isFallback }, categories] = await Promise.all([
    getProducts({
      page: currentPage,
      limit: PRODUCTS_PER_PAGE,
      search: params?.search,
      categoryId: selectedCategoryId,
      type: selectedType,
    }),
    getCategories(),
  ]);

  const totalResults = pagination?.total ?? products.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(totalResults / PRODUCTS_PER_PAGE || 1));
  const activePage = Math.min(Math.max(1, pagination?.page ?? currentPage), totalPages);
  const paginationItems = buildPaginationItems(activePage, totalPages);

  return (
    <main className="catalog-v2">
      {/* ── Editorial header ── */}
      <section className="catalog-v2__hero px-inline">
        <p className="catalog-v2__eyebrow">Khám phá</p>
        <div className="catalog-v2__hero-row">
          <h1 className="catalog-v2__heading">Kho sản phẩm số</h1>
          <div className="catalog-v2__hero-stat">
            <span className="catalog-v2__stat-num">{totalResults}</span>
            <span className="catalog-v2__stat-label">sản phẩm<br />có sẵn</span>
          </div>
        </div>
        <SearchInput defaultValue={params?.search ?? ""} categoryIdFilter={selectedCategoryId} />
      </section>

      {/* ── Filter strip ── */}
      <div className="catalog-v2__filters px-inline">
        <div className="catalog-v2__filter-row">
          <span className="catalog-v2__filter-label">Loại</span>
          <div className="catalog-v2__pill-group">
            {TYPE_FILTERS.map(({ label, value }) => {
              const isActive = selectedType === value || (!selectedType && value === undefined);
              return (
                <Link
                  key={label}
                  href={buildCatalogHref(params?.search, selectedCategoryId, value)}
                  className={`catalog-v2__pill${isActive ? " is-active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="catalog-v2__filter-row">
          <span className="catalog-v2__filter-label">Danh mục</span>
          <div className="catalog-v2__pill-group catalog-v2__pill-group--scroll">
            <Link
              href={buildCatalogHref(params?.search, undefined, selectedType)}
              className={`catalog-v2__pill${!selectedCategoryId ? " is-active" : ""}`}
            >
              Tất cả
            </Link>
            {categories.slice(0, 10).map((cat) => {
              const isActive = selectedCategoryId === String(cat.id);
              return (
                <Link
                  key={cat.id}
                  href={buildCatalogHref(params?.search, String(cat.id), selectedType)}
                  className={`catalog-v2__pill${isActive ? " is-active" : ""}`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="catalog-v2__toolbar px-inline">
        <p className="catalog-v2__result-count">
          <strong>{totalResults}</strong> kết quả
          {params?.search ? <> cho <em>&ldquo;{params.search}&rdquo;</em></> : null}
        </p>
        {isFallback ? <span className="catalog-v2__fallback-badge">Demo</span> : null}
      </div>

      {/* ── Product grid ── */}
      <section className="catalog-v2__products px-inline">
        {products.length ? (
          <>
            <RealtimeCatalogGrid
              initialProducts={products}
              query={{
                page: activePage,
                limit: PRODUCTS_PER_PAGE,
                search: params?.search,
                categoryId: selectedCategoryId,
                type: selectedType,
              }}
            />

            {totalResults >= PRODUCTS_PER_PAGE && totalPages > 1 ? (
              <nav aria-label="Phân trang" className="catalog-v2__pagination">
                <Link
                  href={buildCatalogPageHref({ search: params?.search, categoryId: selectedCategoryId, type: selectedType, page: Math.max(1, activePage - 1) })}
                  aria-disabled={activePage <= 1}
                  className={`catalog-v2__page-btn${activePage <= 1 ? " is-disabled" : ""}`}
                >
                  ← Trước
                </Link>

                {paginationItems.map((pageNumber, index) => {
                  const showGap = index > 0 && paginationItems[index - 1] !== pageNumber - 1;
                  return (
                    <div key={pageNumber} className="contents">
                      {showGap ? <span className="catalog-v2__page-gap">…</span> : null}
                      <Link
                        href={buildCatalogPageHref({ search: params?.search, categoryId: selectedCategoryId, type: selectedType, page: pageNumber })}
                        aria-current={pageNumber === activePage ? "page" : undefined}
                        className={`catalog-v2__page-btn${pageNumber === activePage ? " is-active" : ""}`}
                      >
                        {pageNumber}
                      </Link>
                    </div>
                  );
                })}

                <Link
                  href={buildCatalogPageHref({ search: params?.search, categoryId: selectedCategoryId, type: selectedType, page: Math.min(totalPages, activePage + 1) })}
                  aria-disabled={activePage >= totalPages}
                  className={`catalog-v2__page-btn${activePage >= totalPages ? " is-disabled" : ""}`}
                >
                  Sau →
                </Link>
              </nav>
            ) : null}
          </>
        ) : (
          <div className="catalog-v2__empty">
            <h3>Không tìm thấy sản phẩm</h3>
            <p>Thử từ khoá khác hoặc bỏ bộ lọc hiện tại.</p>
            <Link href="/catalog" className="catalog-v2__empty-cta">
              Xem tất cả sản phẩm
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
