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

function buildCatalogHref(search?: string, categoryId?: string, type?: string) {
  return buildCatalogPageHref({ search, categoryId, type });
}

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
  if (search) {
    query.set("search", search);
  }
  if (categoryId) {
    query.set("categoryId", categoryId);
  }
  if (type) {
    query.set("type", type);
  }
  if (page && page > 1) {
    query.set("page", String(page));
  }
  const serialized = query.toString();
  return serialized ? `/catalog?${serialized}` : "/catalog";
}

function getSafePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  const items = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...items].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right);
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedCategoryId = params?.categoryId;
  const currentPage = getSafePage(params?.page);

  const [{ products, pagination, isFallback }, categories] = await Promise.all([
    getProducts({
      page: currentPage,
      limit: PRODUCTS_PER_PAGE,
      search: params?.search,
      categoryId: selectedCategoryId,
      type: params?.type,
    }),
    getCategories(),
  ]);
  const totalResults = pagination?.total ?? products.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(totalResults / PRODUCTS_PER_PAGE || 1));
  const activePage = Math.min(Math.max(1, pagination?.page ?? currentPage), totalPages);
  const paginationItems = buildPaginationItems(activePage, totalPages);

  return (
    <main>
      <section className="px-inline py-[clamp(58px,7vw,84px)] max-w-[1040px]">
        <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Sản phẩm</p>
        <h1>Tìm sản phẩm số phù hợp trong vài giây</h1>
        <p>
          Dữ liệu ưu tiên backend API;
          khi backend chưa chạy sẽ dùng fallback demo để UI vẫn xem được.
        </p>
        <SearchInput defaultValue={params?.search ?? ""} categoryIdFilter={selectedCategoryId} />
        <div className="mt-4">
          <p className="m-0 mb-3 text-secondary text-[13px] font-extrabold tracking-normal uppercase">Danh mục</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={buildCatalogHref(params?.search, undefined, params?.type)}
              className={!selectedCategoryId ? "inline-flex min-h-[42px] items-center justify-center p-[10px_14px] text-secondary bg-surface border border-border rounded-full text-[14px] font-bold transition-all hover:text-primary hover:border-tertiary/35 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] is-active text-on-accent bg-tertiary border-tertiary" : "inline-flex min-h-[42px] items-center justify-center p-[10px_14px] text-secondary bg-surface border border-border rounded-full text-[14px] font-bold transition-all hover:text-primary hover:border-tertiary/35 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-[1px]"}
            >
              Tất cả danh mục
            </Link>
            {categories.slice(0, 10).map((category) => {
              const isActive = selectedCategoryId === String(category.id);
              return (
                <Link
                  key={category.id}
                  href={buildCatalogHref(params?.search, String(category.id), params?.type)}
                  className={isActive ? "inline-flex min-h-[42px] items-center justify-center p-[10px_14px] text-secondary bg-surface border border-border rounded-full text-[14px] font-bold transition-all hover:text-primary hover:border-tertiary/35 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] is-active text-on-accent bg-tertiary border-tertiary" : "inline-flex min-h-[42px] items-center justify-center p-[10px_14px] text-secondary bg-surface border border-border rounded-full text-[14px] font-bold transition-all hover:text-primary hover:border-tertiary/35 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-[1px]"}
                >
                  {category.name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-inline py-block px-inline py-block">
        <div className="min-w-0">
          <div className="mb-[22px]">
            <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">{totalResults} kết quả</p>
            <h2>Danh sách sản phẩm</h2>
            {isFallback ? <small>Đang hiện fallback demo vì backend chưa sẵn sàng.</small> : null}
          </div>

          {products.length ? (
            <>
              <RealtimeCatalogGrid
                initialProducts={products}
                query={{
                  page: activePage,
                  limit: PRODUCTS_PER_PAGE,
                  search: params?.search,
                  categoryId: selectedCategoryId,
                  type: params?.type,
                }}
              />
              {totalResults >= PRODUCTS_PER_PAGE && totalPages > 1 ? (
                <nav aria-label="Phân trang sản phẩm" className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href={buildCatalogPageHref({
                      search: params?.search,
                      categoryId: selectedCategoryId,
                      type: params?.type,
                      page: Math.max(1, activePage - 1),
                    })}
                    aria-disabled={activePage <= 1}
                    className={`inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full border px-4 text-[14px] font-bold transition-all ${
                      activePage <= 1
                        ? "pointer-events-none border-border/60 bg-neutral text-secondary/60"
                        : "border-border bg-surface text-primary hover:-translate-y-[1px] hover:border-tertiary/35 hover:text-tertiary"
                    }`}
                  >
                    Trước
                  </Link>
                  {paginationItems.map((pageNumber, index) => {
                    const previousPage = paginationItems[index - 1];
                    const showGap = index > 0 && previousPage !== pageNumber - 1;

                    return (
                      <div key={pageNumber} className="contents">
                        {showGap ? <span className="px-1 text-secondary">...</span> : null}
                        <Link
                          href={buildCatalogPageHref({
                            search: params?.search,
                            categoryId: selectedCategoryId,
                            type: params?.type,
                            page: pageNumber,
                          })}
                          aria-current={pageNumber === activePage ? "page" : undefined}
                          className={`inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full border px-3 text-[14px] font-bold transition-all ${
                            pageNumber === activePage
                              ? "border-tertiary bg-tertiary text-on-accent shadow-soft"
                              : "border-border bg-surface text-primary hover:-translate-y-[1px] hover:border-tertiary/35 hover:text-tertiary"
                          }`}
                        >
                          {pageNumber}
                        </Link>
                      </div>
                    );
                  })}
                  <Link
                    href={buildCatalogPageHref({
                      search: params?.search,
                      categoryId: selectedCategoryId,
                      type: params?.type,
                      page: Math.min(totalPages, activePage + 1),
                    })}
                    aria-disabled={activePage >= totalPages}
                    className={`inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full border px-4 text-[14px] font-bold transition-all ${
                      activePage >= totalPages
                        ? "pointer-events-none border-border/60 bg-neutral text-secondary/60"
                        : "border-border bg-surface text-primary hover:-translate-y-[1px] hover:border-tertiary/35 hover:text-tertiary"
                    }`}
                  >
                    Sau
                  </Link>
                </nav>
              ) : null}
            </>
          ) : (
            <div className="grid gap-3 place-items-center p-12 text-center bg-surface border border-card-border rounded-lg shadow-sm">
              <h3>Không có sản phẩm phù hợp</h3>
              <p>Thử từ khóa khác hoặc quay lại trang sản phẩm.</p>
              <Link href={buildCatalogHref(undefined, undefined, params?.type)} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
                Xem tất cả sản phẩm
              </Link>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
