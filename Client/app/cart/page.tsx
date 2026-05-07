"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Square,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCurrency,
  normalizeProduct,
  type ApiEnvelope,
  type BackendProduct,
  type StoreProduct,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import { CART_UPDATED_EVENT, notifyCartChanged } from "@/lib/cart-events";

type CartApiItem = {
  id: number;
  productId: number;
  quantity: number;
  product: BackendProduct;
};

type CartResponse = {
  items: CartApiItem[];
  total: number;
};

type CartLine = CartApiItem & {
  normalizedProduct: StoreProduct;
};

function toCartLine(item: CartApiItem): CartLine {
  return {
    ...item,
    normalizedProduct: normalizeProduct(item.product),
  };
}

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { cartVersion } = useRealtime();
  const { showToast } = useToast();
  const [items, setItems] = useState<CartLine[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const hasLoadedOnce = useRef(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedSet.has(item.id)),
    [items, selectedSet],
  );
  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.normalizedProduct.price * item.quantity, 0),
    [selectedItems],
  );
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const cartActiveStep = 1;
  const cartStepProgress = ((cartActiveStep - 1) / 2) * 100;

  const loadCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setSelectedItemIds([]);
      setIsLoading(false);
      return;
    }

    const silent = hasLoadedOnce.current;
    if (!silent) setIsLoading(true);

    try {
      const response = await apiFetch<ApiEnvelope<CartResponse>>("/cart");
      const nextItems = (response.data.items ?? []).map(toCartLine);
      setItems(nextItems);
      setSelectedItemIds((current) => {
        if (nextItems.length === 0) return [];
        if (current.length === 0) return nextItems.map((item) => item.id);
        const valid = current.filter((id) => nextItems.some((item) => item.id === id));
        return valid.length > 0 ? valid : nextItems.map((item) => item.id);
      });
      hasLoadedOnce.current = true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải giỏ hàng.");
      if (!silent) {
        setItems([]);
        setSelectedItemIds([]);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [apiFetch, isAuthenticated, showToast]);

  useEffect(() => {
    if (!isInitializing) {
      loadCart();
    }
  }, [isInitializing, loadCart]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadCart();
  }, [cartVersion, isAuthenticated, loadCart]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshCart = () => {
      loadCart();
    };

    window.addEventListener(CART_UPDATED_EVENT, refreshCart);
    return () => window.removeEventListener(CART_UPDATED_EVENT, refreshCart);
  }, [isAuthenticated, loadCart]);

  async function updateQuantity(item: CartLine, quantity: number) {
    const nextQuantity = Math.min(Math.max(quantity, 1), Math.max(item.normalizedProduct.stock, 1));
    if (nextQuantity === item.quantity) return;

    setBusyItemId(item.id);
    try {
      await apiFetch<ApiEnvelope<CartApiItem>>(`/cart/items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      setItems((current) =>
        current.map((line) => (line.id === item.id ? { ...line, quantity: nextQuantity } : line)),
      );
      showToast("Đã cập nhật số lượng.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể cập nhật giỏ hàng.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(item: CartLine) {
    setBusyItemId(item.id);
    try {
      await apiFetch<ApiEnvelope<null>>(`/cart/items/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((line) => line.id !== item.id));
      setSelectedItemIds((current) => current.filter((id) => id !== item.id));
      notifyCartChanged();
      showToast("Đã xóa sản phẩm khỏi giỏ.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa sản phẩm.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function clearCart() {
    setIsClearing(true);
    try {
      await apiFetch<ApiEnvelope<null>>("/cart", { method: "DELETE" });
      setItems([]);
      setSelectedItemIds([]);
      notifyCartChanged();
      showToast("Đã xóa toàn bộ giỏ hàng.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa giỏ hàng.");
    } finally {
      setIsClearing(false);
    }
  }

  function toggleItemSelection(itemId: number) {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(items.map((item) => item.id));
  }

  function proceedCheckout() {
    if (selectedItems.length === 0) {
      showToast("Vui lòng chọn ít nhất một sản phẩm để thanh toán.");
      return;
    }
    setIsCheckingOut(true);
    const encodedItems = selectedItems
      .map((item) => `${item.normalizedProduct.id}:${item.quantity}`)
      .join(",");
    router.push(`/checkout?items=${encodeURIComponent(encodedItems)}`);
  }

  if (isInitializing || isLoading) {
    return (
      <main className="px-inline py-block">
        <section className="mb-8 skeleton-panel" />
        <section className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-grid-gap items-start">
          <div className="grid gap-grid-gap skeleton-panel" />
          <aside className="cart-summary skeleton-panel" />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="px-inline py-block">
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <LockKeyhole size={34} />
          <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Giỏ hàng</p>
          <h1>Đăng nhập để xem giỏ hàng</h1>
          <p>Giỏ hàng được đồng bộ theo tài khoản để giữ số lượng, tồn kho và thanh toán an toàn.</p>
          <div className="flex flex-wrap gap-[14px] mt-7">
            <Link href="/login?next=/cart" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
              Đăng nhập
            </Link>
            <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface">
              Xem sản phẩm
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="px-inline py-block">
      <section className="mb-8">
        <div>
          <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Giỏ hàng</p>
          <h1>Giỏ hàng thanh toán ví web</h1>
          <p>Sắp xếp sản phẩm, điều chỉnh số lượng và chuyển sang checkout với duy nhất phương thức ví web.</p>
        </div>
        <div className="cart-hero__badges" aria-label="Cam kết thanh toán">
          <span>
            <ShieldCheck size={16} />
            Ví web nội bộ
          </span>
          <span>
            <PackageCheck size={16} />
            Kho realtime
          </span>
        </div>

        <div className="mt-5 max-w-[560px]">
          <div className="relative px-2">
            <ol className="relative z-[2] mb-2 grid grid-cols-3 gap-2">
              {[
                { step: 1, label: "Giỏ hàng" },
                { step: 2, label: "Thanh toán" },
                { step: 3, label: "Bàn giao" },
              ].map((item) => {
                const isDone = cartActiveStep > item.step;
                const isCurrent = cartActiveStep === item.step;
                return (
                  <li key={item.step} className="grid justify-items-center gap-1 text-center">
                    <span
                      className={
                        isCurrent
                          ? "text-[11px] font-black uppercase tracking-wide text-primary"
                          : isDone
                            ? "text-[11px] font-black uppercase tracking-wide text-success"
                            : "text-[11px] font-extrabold uppercase tracking-wide text-secondary"
                      }
                    >
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="relative h-11">
              <div className="absolute left-[16.6667%] right-[16.6667%] top-[20px] h-[5px] rounded-full bg-border/70" />
              <div
                className="absolute left-[16.6667%] top-[20px] h-[5px] rounded-full bg-[linear-gradient(90deg,var(--color-tertiary),var(--color-accent))] transition-all duration-medium"
                style={{ width: `calc(66.6666% * ${cartStepProgress / 100})` }}
              />
              <div
                style={{ left: `calc(16.6667% + 66.6666% * ${cartStepProgress / 100})`, borderRadius: "9999px", overflow: "hidden" }}
                className="absolute top-[2px] z-[3] h-10 w-10 -translate-x-1/2 border border-white/65 bg-surface p-1 shadow-[0_12px_26px_rgba(0,122,255,0.22)] transition-all duration-medium"
                aria-hidden="true"
              >
                <img src="/logo.jpg" alt="" style={{ borderRadius: "9999px" }} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="grid gap-3 place-items-center p-12 text-center bg-surface border border-card-border rounded-lg shadow-sm empty-state--cart">
          <ShoppingCart size={36} />
          <h2>Giỏ hàng đang trống</h2>
          <p>Chọn sản phẩm đã duyệt để bắt đầu checkout bảo mật.</p>
          <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Khám phá sản phẩm
          </Link>
        </section>
      ) : (
        <section className="cart-layout grid lg:grid-cols-[minmax(0,1fr)_380px] gap-grid-gap items-start">
          <div className="grid gap-grid-gap" aria-label="Sản phẩm trong giỏ">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">{items.length} sản phẩm</p>
                <h2>Danh sách đã chọn</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface min-h-[38px] px-3.5 py-2 text-[13px]"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface min-h-[38px] px-3.5 py-2 text-[13px]"
                  onClick={clearCart}
                  disabled={isClearing}
                >
                  <Trash2 size={16} />
                  Xóa tất cả
                </button>
              </div>
            </div>

            {items.map((item) => {
              const product = item.normalizedProduct;
              const isBusy = busyItemId === item.id;
              return (
                <article key={item.id} className="bg-surface border border-card-border rounded-[20px] shadow-[0_10px_34px_rgba(0,0,0,0.045)] p-3.5 flex gap-3.5 transition-all hover:border-tertiary/25 hover:-translate-y-[2px]">
                  <label className="mt-1 inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center text-secondary hover:text-tertiary">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                    />
                    {selectedSet.has(item.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                  </label>
                  <Link href={`/products/${product.id}`} className="cart-line__visual product-visual grid place-items-center text-primary bg-neutral border border-border transition-all hover:border-tertiary/35">
                    {product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.images[0]} alt={product.name} onError={(e) => { e.currentTarget.src = "/marketplace-console.svg"; }} />
                    ) : (
                      <span>{product.type}</span>
                    )}
                  </Link>
                  <div className="flex-1 grid gap-1 min-w-0">
                    <div>
                      <p className="m-0 mb-[10px] text-secondary text-[11px] font-extrabold tracking-wide uppercase">{product.type}</p>
                      <Link href={`/products/${product.id}`}>
                        <h3>{product.name}</h3>
                      </Link>
                      <p className="cart-line__description">{product.description}</p>
                      <small>{product.stock > 0 ? `${product.stock} còn lại trong kho` : "Hết hàng"}</small>
                    </div>
                    <strong>{formatCurrency(product.price)}</strong>
                  </div>
                  <div className="flex flex-col justify-between items-end">
                    <div className="flex items-center gap-3 bg-neutral border border-border rounded-full px-3 py-1 shadow-sm" aria-label={`Số lượng ${product.name}`}>
                      <button type="button" onClick={() => updateQuantity(item, item.quantity - 1)} disabled={isBusy || item.quantity <= 1}>
                        <Minus size={15} />
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item, item.quantity + 1)} disabled={isBusy || item.quantity >= product.stock}>
                        <Plus size={15} />
                      </button>
                    </div>
                    <button type="button" className="inline-grid w-[38px] h-[38px] place-items-center text-primary bg-surface border border-border rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-[1px] hover:border-tertiary/30 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]" onClick={() => removeItem(item)} disabled={isBusy}>
                      <Trash2 size={17} />
                      <span className="sr-only">Xóa sản phẩm</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="cart-summary sticky top-[calc(var(--header-height)+24px)] self-start">
            <p className="m-0 mb-[14px] text-secondary text-[13px] font-extrabold tracking-normal uppercase">Tóm tắt</p>
            <h2>Thanh toán ví web</h2>
            <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span>Đã chọn</span>
              <strong>{selectedItems.length}/{items.length}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span>Tạm tính</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span>Phí giao dịch</span>
              <strong>0 đ</strong>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border last:border-0 font-bold text-lg">
              <span>Tổng</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="flex items-start gap-2 text-secondary text-xs mt-4 bg-neutral p-3 rounded-md">
              <ShieldCheck size={18} />
              <span>Chỉ hỗ trợ thanh toán bằng ví web. Sản phẩm đã chọn sẽ được chuyển sang checkout để trừ ví.</span>
            </div>
            <button
              type="button"
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary checkout-submit disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-soft"
              onClick={proceedCheckout}
              disabled={selectedItems.length === 0 || isCheckingOut}
            >
              {selectedItems.length > 1
                ? `Thanh toán ví ${selectedItems.length} sản phẩm`
                : selectedItems.length === 1
                  ? "Thanh toán ví cho sản phẩm"
                  : "Chọn sản phẩm để thanh toán ví"}
            </button>
            <Link href="/catalog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-primary bg-transparent border border-border shadow-none hover:text-tertiary hover:border-tertiary/40 hover:bg-surface">
              Tiếp tục mua
            </Link>
          </aside>
        </section>
      )}

      {false && items.length > 0 && (
        <div className="cart-mobile-bar lg:hidden">
          <div className="cart-mobile-bar__summary">
            <small>{selectedItems.length}/{items.length} sản phẩm</small>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <button
            type="button"
            className="cart-mobile-bar__btn"
            onClick={proceedCheckout}
            disabled={selectedItems.length === 0 || isCheckingOut}
          >
            Thanh toán
          </button>
        </div>
      )}
    </main>
  );
}
