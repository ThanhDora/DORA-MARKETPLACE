import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
        <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">404</p>
        <h1>Không tìm thấy trang.</h1>
        <p>Trang hoặc sản phẩm bạn đang tìm có thể đã được gỡ khỏi kho hàng.</p>
        <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
          Về kho hàng
        </Link>
      </section>
    </main>
  );
}
