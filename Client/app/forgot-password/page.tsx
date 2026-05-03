import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
