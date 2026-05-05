"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency, isNumericId, requestJson, safeImageUrls, type ApiEnvelope } from "@/lib/api";

type Suggestion = {
  id: number;
  name: string;
  price: number;
  type: string;
  images: string[];
  slug: string | null;
};

export function SearchInput({
  defaultValue = "",
  typeFilter,
  categoryIdFilter,
}: {
  defaultValue?: string;
  typeFilter?: string;
  categoryIdFilter?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.trim().length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await requestJson<ApiEnvelope<Suggestion[]>>(`/products/suggestions?q=${encodeURIComponent(q)}&limit=8`);
      const normalized = (res.data ?? []).map((s) => ({ ...s, images: safeImageUrls(s.images) }));
      setSuggestions(normalized);
      setIsOpen(normalized.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function getProductHref(p: Suggestion) {
    return `/products/${isNumericId(String(p.id)) ? p.id : p.slug}`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        searchFormRef.current?.requestSubmit();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          router.push(getProductHref(suggestions[activeIndex]));
          setIsOpen(false);
          inputRef.current?.blur();
        } else {
          searchFormRef.current?.requestSubmit();
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  const typeLabel = (t: string) => {
    switch (t) {
      case "ACCOUNT": return "TK";
      case "KEY": return "Key";
      case "FILE": return "File";
      default: return t;
    }
  };

  return (
    <div ref={containerRef} className="search-autocomplete">
      <form ref={searchFormRef} action="/catalog" className="flex w-full max-w-[720px] min-h-[58px] items-center gap-3 mt-[30px] p-2 pl-4 bg-surface border border-card-border rounded-[var(--radius-lg)] shadow-soft transition-all focus-within:border-tertiary/45 focus-within:shadow-hover focus-within:-translate-y-[1px]">
        <Search size={18} />
        <input
          ref={inputRef}
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder="Tìm tài khoản, key, file..."
          autoComplete="off"
        />
        {typeFilter ? <input name="type" type="hidden" value={typeFilter} /> : null}
        {categoryIdFilter ? <input name="categoryId" type="hidden" value={categoryIdFilter} /> : null}
        <button type="submit">Tìm kiếm</button>
      </form>

      {isOpen && suggestions.length > 0 ? (
        <ul className="search-suggestions">
          {suggestions.map((s, i) => (
            <li key={s.id} className={i === activeIndex ? "is-active text-on-accent bg-tertiary border-tertiary" : ""}>
              <Link
                href={getProductHref(s)}
                onClick={() => setIsOpen(false)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {s.images[0] ? (
                  <img src={s.images[0]} alt="" width={36} height={36} loading="lazy" />
                ) : (
                  <span className="suggestion-type-badge">{typeLabel(s.type)}</span>
                )}
                <div className="suggestion-body">
                  <strong>{s.name}</strong>
                  <small>{formatCurrency(s.price)}</small>
                </div>
              </Link>
            </li>
          ))}
          <li className="search-suggestions__all">
            <Link href={`/catalog?search=${encodeURIComponent(query)}${categoryIdFilter ? `&categoryId=${encodeURIComponent(categoryIdFilter)}` : ""}`} onClick={() => setIsOpen(false)}>
              <span>Xem tất cả kết quả cho &quot;{query}&quot;</span>
              <span className="search-suggestions__all-arrow">
                <ArrowRight size={14} strokeWidth={2.5} />
              </span>
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
