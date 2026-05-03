import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LoginForm } from "@/components/AuthForms";
import { fallbackAuthGif, AUTH_GIF_CACHE_KEY, parseAuthGifPayload } from "@/lib/auth-gif";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const initialGif = parseAuthGifPayload(cookieStore.get(AUTH_GIF_CACHE_KEY)?.value) ?? fallbackAuthGif();

  return (
    <>
      <link rel="dns-prefetch" href="https://nekos.best" />
      <link rel="preconnect" href="https://nekos.best" />
      <LoginForm initialGif={initialGif} />
    </>
  );
}
