import type { Metadata } from "next";
import { cookies } from "next/headers";
import { RegisterForm } from "@/components/AuthForms";
import { fallbackAuthGif, AUTH_GIF_CACHE_KEY, parseAuthGifPayload } from "@/lib/auth-gif";

export const metadata: Metadata = {
  title: "Đăng ký",
};

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const initialGif = parseAuthGifPayload(cookieStore.get(AUTH_GIF_CACHE_KEY)?.value) ?? fallbackAuthGif();
  return <RegisterForm initialGif={initialGif} />;
}
