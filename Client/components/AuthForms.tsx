"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { requestJson, type ApiEnvelope } from "@/lib/api";
import {
  AUTH_GIF_CACHE_KEY,
  AUTH_GIF_FALLBACK_IMAGE,
  fallbackAuthGif,
  parseAuthGifPayload,
  serializeAuthGifPayload,
  type AuthGifPayload,
} from "@/lib/auth-gif";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu ít nhất 8 ký tự")
  .regex(/[A-Z]/, "Cần 1 chữ hoa")
  .regex(/[a-z]/, "Cần 1 chữ thường")
  .regex(/[0-9]/, "Cần 1 số")
  .regex(/[^A-Za-z0-9]/, "Cần 1 ký tự đặc biệt");

type ZenQuoteApiResponse = {
  quote: string | null;
  author: string | null;
};

const AUTH_GIF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function readCachedAuthGif() {
  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage = parseAuthGifPayload(window.localStorage.getItem(AUTH_GIF_CACHE_KEY));
  if (fromStorage) {
    return fromStorage;
  }

  return parseAuthGifPayload(readCookieValue(AUTH_GIF_CACHE_KEY));
}

function writeCachedAuthGif(payload: AuthGifPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = serializeAuthGifPayload(payload);

  try {
    window.localStorage.setItem(AUTH_GIF_CACHE_KEY, serialized);
  } catch {
    // Ignore storage write failures.
  }

  document.cookie = `${AUTH_GIF_CACHE_KEY}=${serialized}; path=/; max-age=${AUTH_GIF_COOKIE_MAX_AGE}; samesite=lax`;
}

function preloadGif(src: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", handleAbort);
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    image.decoding = "async";
    image.onload = () => {
      cleanup();
      resolve();
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Failed to preload GIF"));
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = src;
  });
}

function AsideGif({ gif }: { gif: AuthGifPayload | null }) {
  const [currentGif, setCurrentGif] = useState<AuthGifPayload>(() => gif ?? fallbackAuthGif());
  const [previousGif, setPreviousGif] = useState<AuthGifPayload | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const currentGifRef = useRef<AuthGifPayload>(gif ?? fallbackAuthGif());
  const aspectRatio =
    currentGif?.width && currentGif?.height
      ? `${currentGif.width} / ${currentGif.height}`
      : gif?.width && gif?.height
        ? `${gif.width} / ${gif.height}`
        : "16 / 9";

  useEffect(() => {
    currentGifRef.current = currentGif;
    writeCachedAuthGif(currentGif);
  }, [currentGif]);

  useEffect(() => {
    const cachedGif = readCachedAuthGif();
    if (cachedGif?.gifUrl && cachedGif.gifUrl !== currentGifRef.current.gifUrl) {
      setCurrentGif(cachedGif);
    }

    const controller = new AbortController();

    async function refreshGif() {
      try {
        const response = await fetch(`/api/auth-gif?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as AuthGifPayload;
        if (!payload.gifUrl || payload.gifUrl === currentGifRef.current.gifUrl) {
          if (payload.gifUrl) {
            writeCachedAuthGif(payload);
          }
          return;
        }

        await preloadGif(payload.gifUrl, controller.signal);
        if (controller.signal.aborted) return;

        const previous = currentGifRef.current;
        setPreviousGif(previous);
        setCurrentGif(payload);

        if (transitionTimerRef.current) {
          window.clearTimeout(transitionTimerRef.current);
        }
        transitionTimerRef.current = window.setTimeout(() => {
          setPreviousGif(null);
          transitionTimerRef.current = null;
        }, 320);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    refreshGif();
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  return (
    <figure className="auth-neko-gif">
      <div className="auth-neko-gif__frame is-ready" style={{ aspectRatio }}>
        {previousGif?.gifUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previousGif.gifUrl}
            alt=""
            className="auth-neko-gif__image auth-neko-gif__image--previous is-exiting"
            aria-hidden="true"
          />
        ) : null}
        {currentGif?.gifUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentGif.gifUrl}
            alt={currentGif.title}
            className="auth-neko-gif__image is-visible"
            width={currentGif.width ?? 498}
            height={currentGif.height ?? 280}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
    </figure>
  );
}

function PasswordToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      className="inline-grid h-8 w-8 place-items-center rounded-full text-secondary transition hover:text-primary"
    >
      {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

export function LoginForm({ initialGif = null }: { initialGif?: AuthGifPayload | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const next = params.get("next") || "/account";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const email = z.string().email().parse(String(form.get("email") || ""));
      const password = z.string().min(1).parse(String(form.get("password") || ""));
      await login(email, password);
      router.push(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthShell
      title="Đăng nhập"
      text="Truy cập giỏ hàng, đơn hàng, bảng điều khiển seller và admin."
      asideVisual={<AsideGif gif={initialGif} />}
    >
      <form className="auth-form grid gap-3.5" onSubmit={submit}>
        <label className="block mb-4">
          Email
          <span className="flex items-center gap-2 mt-1 relative">
            <Mail size={16} />
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" />
          </span>
          <small className="block text-xs text-secondary mt-1">Dùng email đã đăng ký và xác minh.</small>
        </label>
        <label className="block mb-4">
          Mật khẩu
          <span className="flex items-center gap-2 mt-1 relative">
            <LockKeyhole size={16} />
            <input
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              required
              className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
            />
            <PasswordToggle isVisible={isPasswordVisible} onToggle={() => setIsPasswordVisible((value) => !value)} />
          </span>
          <small className="block text-xs text-secondary mt-1">Phân biệt chữ hoa, chữ thường.</small>
        </label>
        <button type="submit" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary" disabled={isBusy}>
          Đăng nhập
          <ArrowRight size={17} />
        </button>
        <div className="flex items-center gap-4 mt-4 text-sm font-bold text-secondary">
          <Link href="/forgot-password">Quên mật khẩu</Link>
          <Link href="/register">Tạo tài khoản</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function RegisterForm({ initialGif = null }: { initialGif?: AuthGifPayload | null }) {
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { register } = useAuth();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const input = z
        .object({
          name: z.string().min(1).max(100),
          email: z.string().email(),
          password: passwordSchema,
          role: z.literal("USER"),
        })
        .parse({
          name: String(form.get("name") || ""),
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
          role: "USER",
        });
      const msg = await register(input);
      showToast(msg, "success");
      event.currentTarget.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      text="Cần xác minh email trước khi đăng nhập theo backend hiện tại."
      asideVisual={(
        <>
          <div className="auth-register-note">
            <strong>Bắt đầu nhanh</strong>
            <span>Đăng ký xong là có thể theo dõi đơn hàng và lưu sản phẩm yêu thích.</span>
          </div>
          <AsideGif gif={initialGif} />
        </>
      )}
    >
      <form className="auth-form grid gap-3.5" onSubmit={submit}>
        <label className="block mb-4">
          Tên hiển thị
          <span className="flex items-center gap-2 mt-1 relative">
            <UserRound size={16} />
            <input name="name" autoComplete="name" placeholder="Nguyen Van A" required className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" />
          </span>
          <small className="block text-xs text-secondary mt-1">Tên sẽ hiển thị trong hồ sơ và đơn hàng.</small>
        </label>
        <label className="block mb-4">
          Email
          <span className="flex items-center gap-2 mt-1 relative">
            <Mail size={16} />
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" />
          </span>
        </label>
        <label className="block mb-4">
          Mật khẩu
          <span className="flex items-center gap-2 mt-1 relative">
            <LockKeyhole size={16} />
            <input
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              required
              className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
            />
            <PasswordToggle isVisible={isPasswordVisible} onToggle={() => setIsPasswordVisible((value) => !value)} />
          </span>
          <small className="block text-xs text-secondary mt-1">Cần chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
        </label>
        <button type="submit" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary" disabled={isBusy}>
          Đăng ký
          <ShieldCheck size={17} />
        </button>
        <div className="flex items-center gap-4 mt-4 text-sm font-bold text-secondary">
          <Link href="/login">Đã có tài khoản</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const email = z.string().email().parse(String(form.get("email") || ""));
      const response = await requestJson<ApiEnvelope<null>>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        notifySuccess: false,
      });
      showToast(response.message ?? "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể gửi yêu cầu.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthShell title="Khôi phục mật khẩu" text="Backend gửi link đặt lại mật khẩu về email nếu tài khoản tồn tại.">
      <form className="auth-form grid gap-3.5" onSubmit={submit}>
        <label className="block mb-4">
          Email
          <span className="flex items-center gap-2 mt-1 relative">
            <Mail size={16} />
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" />
          </span>
          <small className="block text-xs text-secondary mt-1">Hệ thống sẽ gửi link đặt lại nếu email tồn tại.</small>
        </label>
        <button type="submit" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary" disabled={isBusy}>
          Gửi link đặt lại
        </button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const token = params.get("token") || "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const password = passwordSchema.parse(String(form.get("password") || ""));
      const response = await requestJson<ApiEnvelope<null>>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        notifySuccess: false,
      });
      showToast(response.message ?? "Đã đặt lại mật khẩu.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reset thất bại.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthShell title="Đặt lại mật khẩu" text="Mật khẩu mới cần đủ mạnh theo validation backend.">
      <form className="auth-form grid gap-3.5" onSubmit={submit}>
        <label className="block mb-4">
          Mật khẩu mới
          <span className="flex items-center gap-2 mt-1 relative">
            <LockKeyhole size={16} />
            <input
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              required
              className="flex-1 min-h-0 border-0 border-none bg-transparent p-0 shadow-none outline-none appearance-none focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
            />
            <PasswordToggle isVisible={isPasswordVisible} onToggle={() => setIsPasswordVisible((value) => !value)} />
          </span>
          <small className="block text-xs text-secondary mt-1">Mật khẩu mạnh: 8+ ký tự, đủ chữ hoa/thường, số, ký tự đặc biệt.</small>
        </label>
        <button type="submit" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary" disabled={isBusy || !token}>
          Đặt lại mật khẩu
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  title,
  text,
  asideVisual,
  children,
}: {
  title: string;
  text: string;
  asideVisual?: ReactNode;
  children: ReactNode;
}) {
  const [quote, setQuote] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [isQuoteReady, setIsQuoteReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadQuote() {
      try {
        const response = await fetch("/api/zenquote", { cache: "no-store" });
        if (!response.ok) {
          if (isMounted) {
            setQuote(null);
            setAuthor(null);
            setIsQuoteReady(true);
          }
          return;
        }
        const payload = (await response.json()) as ZenQuoteApiResponse;
        if (!isMounted) return;
        setQuote(payload.quote?.trim() || null);
        setAuthor(payload.author?.trim() || null);
        setIsQuoteReady(true);
      } catch {
        if (isMounted) {
          setQuote(null);
          setAuthor(null);
          setIsQuoteReady(true);
        }
      }
    }

    loadQuote();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main>
      <section className="px-inline grid md:grid-cols-2 gap-8 items-start py-block">
        <div className="bg-surface border border-card-border rounded-lg shadow-soft p-6">
          <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Truy cập bảo mật</p>
          <h1>{title}</h1>
          <p>{text}</p>
          {children}
        </div>
        <div className="bg-surface border border-card-border rounded-lg shadow-soft p-6 grid gap-4">
          {asideVisual ? <div className="auth-aside__visual">{asideVisual}</div> : null}
          <ShieldCheck size={28} />
          <h2>Góc Truyền Cảm Hứng</h2>
          <div className={isQuoteReady ? "auth-quote-block is-ready" : "auth-quote-block"}>
            <p>{quote ? `"${quote}"` : isQuoteReady ? "Chưa có trích dẫn từ API." : "Đang tải trích dẫn..."}</p>
            {author ? <small className="auth-quote-author">- {author}</small> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
