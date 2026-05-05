"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "./SearchInput";

type CatalogSearchWatcherProps = {
  defaultValue?: string;
  categoryIdFilter?: string;
};

export function CatalogSearchWatcher({ defaultValue, categoryIdFilter }: CatalogSearchWatcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const navDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navDebounceRef.current) clearTimeout(navDebounceRef.current);
    };
  }, []);

  const handleQueryChange = useCallback(
    (q: string) => {
      if (navDebounceRef.current) clearTimeout(navDebounceRef.current);
      navDebounceRef.current = setTimeout(() => {
        const next = new URLSearchParams(searchParams.toString());
        if (q) {
          next.set("search", q);
        } else {
          next.delete("search");
        }
        next.delete("page");
        router.replace(`/catalog?${next.toString()}`, { scroll: false });
      }, 400);
    },
    [router, searchParams],
  );

  return (
    <SearchInput
      defaultValue={defaultValue}
      categoryIdFilter={categoryIdFilter}
      filterOnSuggest
      onQueryChange={handleQueryChange}
    />
  );
}
