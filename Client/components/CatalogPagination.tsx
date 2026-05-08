"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  activePage: number;
  totalPages: number;
  paginationItems: number[];
  search?: string;
  categoryId?: string;
  type?: string;
};

function buildHref(page: number, search?: string, categoryId?: string, type?: string) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (categoryId) query.set("categoryId", categoryId);
  if (type) query.set("type", type);
  if (page && page > 1) query.set("page", String(page));
  const serialized = query.toString();
  return serialized ? `/catalog?${serialized}` : "/catalog";
}

export function CatalogPagination({
  activePage,
  totalPages,
  paginationItems,
  search,
  categoryId,
  type,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const go = (e: React.MouseEvent, target: number) => {
    e.preventDefault();
    if (target === activePage || target < 1 || target > totalPages || isPending) return;

    const node = document.querySelector<HTMLElement>(".catalog-v2__products");
    if (node) {
      const top = node.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: "smooth" });
    }

    startTransition(() => {
      router.push(buildHref(target, search, categoryId, type), { scroll: false });
    });
  };

  return (
    <>
      <div
        className={`catalog-progress${isPending ? " is-on" : ""}`}
        aria-hidden="true"
      />
      <nav
        aria-label="Phân trang"
        aria-busy={isPending}
        className={`catalog-v2__pagination${isPending ? " is-pending" : ""}`}
      >
        <a
          href={buildHref(Math.max(1, activePage - 1), search, categoryId, type)}
          aria-disabled={activePage <= 1}
          aria-label="Trang trước"
          className={`catalog-v2__page-btn catalog-v2__page-btn--nav${
            activePage <= 1 ? " is-disabled" : ""
          }`}
          onClick={(e) => go(e, activePage - 1)}
        >
          <ChevronLeft size={14} strokeWidth={2.2} />
          <span className="catalog-v2__page-label">Trước</span>
        </a>

        {paginationItems.map((pageNumber, index) => {
          const showGap = index > 0 && paginationItems[index - 1] !== pageNumber - 1;
          const isActive = pageNumber === activePage;
          return (
            <span key={pageNumber} className="contents">
              {showGap ? (
                <span className="catalog-v2__page-gap" aria-hidden="true">
                  …
                </span>
              ) : null}
              <a
                href={buildHref(pageNumber, search, categoryId, type)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Trang ${pageNumber}`}
                className={`catalog-v2__page-btn${isActive ? " is-active" : ""}`}
                onClick={(e) => go(e, pageNumber)}
              >
                {pageNumber}
              </a>
            </span>
          );
        })}

        <a
          href={buildHref(Math.min(totalPages, activePage + 1), search, categoryId, type)}
          aria-disabled={activePage >= totalPages}
          aria-label="Trang sau"
          className={`catalog-v2__page-btn catalog-v2__page-btn--nav${
            activePage >= totalPages ? " is-disabled" : ""
          }`}
          onClick={(e) => go(e, activePage + 1)}
        >
          <span className="catalog-v2__page-label">Sau</span>
          <ChevronRight size={14} strokeWidth={2.2} />
        </a>
      </nav>
    </>
  );
}
