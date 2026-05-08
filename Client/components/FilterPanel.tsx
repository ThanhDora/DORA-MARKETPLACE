"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { ProductType, Category } from "@/lib/api";

type FilterPanelProps = {
  categories: Category[];
  selectedType?: ProductType;
  selectedCategoryId?: string;
  currentSearch?: string;
};

const typeFilters: Array<{ label: string; value?: ProductType }> = [
  { label: "Tất cả" },
  { label: "Tài khoản", value: "ACCOUNT" },
  { label: "Key", value: "KEY" },
  { label: "File", value: "FILE" },
];

const filterButtonClass = "catalog-filter-button";
const activeFilterButtonClass = "catalog-filter-button is-active";

function hrefForType(type: ProductType | undefined, search?: string, categoryId?: string) {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (search) query.set("search", search);
  if (categoryId) query.set("categoryId", categoryId);
  const serialized = query.toString();
  return serialized ? `/catalog?${serialized}` : "/catalog";
}

function hrefForCategory(categoryId: string, type?: ProductType) {
  const query = new URLSearchParams();
  query.set("categoryId", categoryId);
  if (type) query.set("type", type);
  return `/catalog?${query.toString()}`;
}

export function FilterPanel({ categories, selectedType, selectedCategoryId, currentSearch }: FilterPanelProps) {
  const filterContent = (
    <>
      <div className="grid grid-cols-[auto_1fr] items-center gap-4 mb-4">
        <SlidersHorizontal size={18} />
        <strong>Bộ lọc</strong>
      </div>
      <div className="grid gap-4">
        <div>
          <span className="block mb-2.5 text-secondary text-[12px] font-extrabold uppercase">Loại sản phẩm</span>
          <div className="flex gap-2.5 flex-wrap items-stretch">
            {typeFilters.map((filter) => (
              <Link
                key={filter.label}
                href={hrefForType(filter.value, currentSearch, selectedCategoryId)}
                className={
                  filter.value === selectedType || (!filter.value && !selectedType)
                    ? activeFilterButtonClass
                    : filterButtonClass
                }
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <span className="block mb-2.5 text-secondary text-[12px] font-extrabold uppercase">Danh mục</span>
          <div className="flex gap-2.5 flex-wrap items-stretch">
            <Link
              href={hrefForType(selectedType, currentSearch)}
              className={!selectedCategoryId ? activeFilterButtonClass : filterButtonClass}
            >
              Tất cả danh mục
            </Link>
            {categories.slice(0, 8).map((category) => (
              <Link
                key={category.id}
                href={hrefForCategory(String(category.id), selectedType)}
                className={selectedCategoryId === String(category.id) ? activeFilterButtonClass : filterButtonClass}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <aside className="sticky top-[calc(var(--header-height)+18px)] p-4 bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all hover:border-tertiary/25">{filterContent}</aside>
  );
}
