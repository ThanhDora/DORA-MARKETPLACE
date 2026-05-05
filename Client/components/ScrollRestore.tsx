"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

function buildKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

function readPosition(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(`scroll:${key}`);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writePosition(key: string, pos: number) {
  try {
    sessionStorage.setItem(`scroll:${key}`, String(pos));
  } catch {}
}

export function getScrollTarget(
  pathname: string,
  search: string,
  savedPosition: number | null,
): number | null {
  if (pathname === "/" && !search) return null;
  if (pathname.startsWith("/products/")) return 0;
  if (savedPosition === null || savedPosition <= 0) return null;
  return savedPosition;
}

function scrollToPosition(top: number) {
  window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
}

export function ScrollRestore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const key = buildKey(pathname, search);
  const scrollY = useRef(0);
  const savedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Track current scroll position
  useEffect(() => {
    scrollY.current = window.scrollY;
    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Save position before any navigation
  useEffect(() => {
    const save = () => {
      if (savedKey.current) {
        writePosition(savedKey.current, scrollY.current);
      }
    };
    savedKey.current = key;

    // popstate fires BEFORE the browser navigates back/forward
    window.addEventListener("popstate", save);
    // Capture internal link clicks before Next.js router handles them
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (link) {
        const href = link.getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("http")) {
          save();
        }
      }
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("popstate", save);
      document.removeEventListener("click", onClick, true);
    };
  }, [key]);

  // Restore saved position on route change. Product pages always start at top,
  // including hard reloads where browsers may otherwise restore the old offset.
  useLayoutEffect(() => {
    const pos = readPosition(key);
    const target = getScrollTarget(pathname, search, pos);
    if (target === null) return;
    if (target === 0) {
      scrollToPosition(0);
      return;
    }

    const restore = () => {
      scrollToPosition(target);
    };
    requestAnimationFrame(restore);
  }, [key, pathname, search]);

  return null;
}
