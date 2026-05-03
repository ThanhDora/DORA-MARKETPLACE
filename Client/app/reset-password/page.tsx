import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/AuthForms";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu",
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
