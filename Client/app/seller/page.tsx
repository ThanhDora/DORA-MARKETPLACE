"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, CreditCard, ImagePlus, PackageOpen, PackagePlus, Pencil, ReceiptText, Search, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  formatCurrency,
  normalizeProduct,
  statusLabel,
  type ApiEnvelope,
  type ApiList,
  type BackendProduct,
  type Category,
  type Order,
  type PaymentMethod,
  type ProductType,
  type StoreProduct,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

type PaymentConfig = {
  id: number;
  method: PaymentMethod;
  config: Record<string, unknown>;
  isActive: boolean;
};

type Payout = {
  id: number;
  amount: string | number;
  status: string;
  createdAt?: string;
};

type Plan = {
  id: number;
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  maxProducts?: number;
  features?: string[];
};

type MySubscription = {
  id: number;
  planId: number;
  status: string;
  startDate: string;
  endDate: string;
  plan: Plan;
};

const tabs = ["products", "orders", "payouts", "payments", "plans"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  products: "Sản phẩm",
  orders: "Đơn bán",
  payouts: "Rút tiền",
  payments: "Thanh toán",
  plans: "Gói bán",
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function resourcesToText(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return "";
  const value = metadata.resources;
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("\n");
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export default function SellerPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mySubscription, setMySubscription] = useState<MySubscription | null>(null);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const canSell = user?.role === "SELLER" || user?.role === "ADMIN";
  const firstCategoryId = categories[0]?.id ? String(categories[0].id) : "";
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "status">("name");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.categoryName ?? "").toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return a.price - b.price;
        case "stock":
          return a.stock - b.stock;
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return result;
  }, [products, searchQuery, sortBy]);

  const statsCards = useMemo(
    () => [
      { label: "Sản phẩm", value: products.length },
      { label: "Đơn bán", value: orders.length },
      { label: "Thanh toán", value: payouts.length },
      { label: "Gói", value: plans.length },
    ],
    [orders.length, payouts.length, products.length, plans.length],
  );

  useEffect(() => {
    if (!isAuthenticated || !canSell) {
      return;
    }
    loadSellerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, canSell]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    setExistingImages(editingProduct?.images ?? []);
    setSelectedImageFiles([]);
    setSelectedImagePreviews([]);
  }, [editingProduct]);

  useEffect(() => {
    const nextPreviews = selectedImageFiles.map((file) => URL.createObjectURL(file));
    setSelectedImagePreviews(nextPreviews);
    return () => {
      nextPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImageFiles]);

  function handlePickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const accepted: File[] = [];
    const rejected: string[] = [];

    files.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        rejected.push(`${file.name} (định dạng không hỗ trợ)`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name} (vượt quá 5MB)`);
        return;
      }
      accepted.push(file);
    });

    if (rejected.length) {
      showToast(`Một số ảnh không hợp lệ: ${rejected.slice(0, 2).join(", ")}`, "error");
    }

    setSelectedImageFiles((prev) => [...prev, ...accepted].slice(0, 12));
    event.target.value = "";
  }

  function removePickedImage(index: number) {
    setSelectedImageFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function removeExistingImage(index: number) {
    setExistingImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadPickedImages() {
    if (!selectedImageFiles.length) return [];
    const formData = new FormData();
    selectedImageFiles.forEach((file) => formData.append("images", file));
    const response = await apiFetch<ApiEnvelope<{ urls: string[] }>>("/products/upload-images", {
      method: "POST",
      body: formData,
      notifySuccess: false,
    });
    return Array.isArray(response.data?.urls) ? response.data.urls : [];
  }

  async function loadSellerData() {
    try {
      const [productsRes, categoriesRes, ordersRes, payoutsRes, configsRes, statsRes, plansRes, subRes] =
        await Promise.allSettled([
          apiFetch<ApiList<BackendProduct>>("/seller/products?limit=500"),
          apiFetch<ApiList<Category>>("/categories?limit=100&isActive=true"),
          apiFetch<ApiList<Order>>("/seller/orders?limit=20"),
          apiFetch<ApiList<Payout>>("/seller/payouts?limit=20"),
          apiFetch<ApiEnvelope<PaymentConfig[]>>("/seller/payment-configs"),
          apiFetch<ApiEnvelope<Record<string, unknown>>>("/seller/stats"),
          apiFetch<ApiEnvelope<Plan[]>>("/subscriptions/plans"),
          apiFetch<ApiEnvelope<MySubscription>>("/subscriptions/my"),
        ]);

      if (productsRes.status === "fulfilled") setProducts(productsRes.value.data.map(normalizeProduct));
      if (categoriesRes.status === "fulfilled") setCategories(categoriesRes.value.data);
      if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.data);
      if (payoutsRes.status === "fulfilled") setPayouts(payoutsRes.value.data);
      if (configsRes.status === "fulfilled") setPaymentConfigs(configsRes.value.data ?? []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data ?? {});
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data ?? []);
      if (subRes.status === "fulfilled") setMySubscription(subRes.value.data ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải seller dashboard.");
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const resources = String(form.get("resources") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const name = String(form.get("name") || "").trim();
    const price = Number(form.get("price") || 0);
    const categoryId = Number(form.get("categoryId") || firstCategoryId || 0);
    const stock = Number(form.get("stock") || 1);
    const type = String(form.get("type") || "ACCOUNT") as ProductType;

    if (!name) {
      showToast("Tên sản phẩm là bắt buộc.", "error");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast("Giá sản phẩm phải lớn hơn 0.", "error");
      return;
    }
    if (!categoryId) {
      showToast("Chưa có danh mục hoạt động. Vui lòng tạo/kích hoạt danh mục trước khi đăng sản phẩm.", "error");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      showToast("Tồn kho không hợp lệ.", "error");
      return;
    }

    try {
      let uploadedImageUrls: string[] = [];
      if (selectedImageFiles.length) {
        uploadedImageUrls = await uploadPickedImages();
      }

      const images = [...existingImages, ...uploadedImageUrls];
      const payload = {
        name,
        description: String(form.get("description") || ""),
        price,
        categoryId,
        type,
        stock,
        images,
        metadata: { source: "seller-dashboard", resources },
      };

      if (editingProduct) {
        await apiFetch<ApiEnvelope<BackendProduct>>(`/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Đã cập nhật sản phẩm.", "success");
      } else {
        await apiFetch<ApiEnvelope<BackendProduct>>("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Đã tạo sản phẩm, đang chờ admin duyệt.", "success");
      }
      setEditingProduct(null);
      formEl.reset();
      setSelectedImageFiles([]);
      setSelectedImagePreviews([]);
      setExistingImages([]);
      await loadSellerData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu sản phẩm.");
    }
  }

  async function deleteProduct(product: StoreProduct) {
    try {
      await apiFetch<ApiEnvelope<null>>(`/products/${product.id}`, { method: "DELETE" });
      showToast("Đã xóa sản phẩm.", "success");
      await loadSellerData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể xóa sản phẩm.");
    }
  }

  async function savePaymentConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const method = String(form.get("method") || "BANK_TRANSFER") as PaymentMethod;
    const config = {
      account: String(form.get("account") || ""),
      note: String(form.get("note") || ""),
    };
    try {
      await apiFetch<ApiEnvelope<PaymentConfig>>("/subscriptions/payment-configs", {
        method: "POST",
        body: JSON.stringify({ method, config }),
      });
      showToast("Đã lưu cấu hình thanh toán.", "success");
      formEl.reset();
      await loadSellerData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
    }
  }

  async function subscribeToPlan(planId: number) {
    try {
      await apiFetch<ApiEnvelope<MySubscription>>("/subscriptions/buy", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      showToast("Đã đăng ký plan, vui lòng chờ xác nhận thanh toán.", "success");
      await loadSellerData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể đăng ký plan.");
    }
  }

  if (isInitializing) return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;

  if (!isAuthenticated || !canSell) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <h1>Cần quyền seller</h1>
          <p>Đăng nhập bằng tài khoản SELLER hoặc ADMIN để quản lý sản phẩm.</p>
          <Link href="/login?next=/seller" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="px-inline py-block">
      <section className="flex flex-wrap items-center justify-between gap-[14px] mb-[34px]">
        <div>
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 mb-[14px] text-[13px] font-extrabold text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <h1>Quản lý kênh bán</h1>
          <p>Quản lý sản phẩm, theo dõi đơn bán, thanh toán và cấu hình thanh toán.</p>
        </div>
        <div className="flex items-center gap-[7px]">
          <span>{user?.role}</span>
          <span>{String(stats.status ?? "API sẵn sàng")}</span>
        </div>
      </section>

      <section className="grid gap-grid-gap sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <article key={card.label} className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all hover:border-tertiary/25 hover:-translate-y-[2px] p-5 text-center grid gap-1">
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "is-active text-on-accent bg-tertiary border-tertiary" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === "products" ? (
        <section className="dashboard-grid dashboard-grid--editor">
          <form className="seller-product-editor" onSubmit={saveProduct}>
            <div className="seller-product-editor__head">
              <PackagePlus size={20} />
              <div>
                <h2>{editingProduct ? "Sửa sản phẩm" : "Tạo sản phẩm"}</h2>
                <p>Điền đầy đủ thông tin để gửi duyệt lên marketplace.</p>
              </div>
            </div>
            <label>
              Tên sản phẩm
              <input name="name" defaultValue={editingProduct?.name} placeholder="Ví dụ: Netflix Premium 1 tháng" required />
            </label>
            <label>
              Mô tả
              <textarea name="description" defaultValue={editingProduct?.description} rows={4} placeholder="Mô tả quyền lợi, điều kiện sử dụng và chính sách hỗ trợ." />
            </label>
            <label>
              Tài nguyên (account / key), mỗi dòng một mục
              <textarea
                name="resources"
                defaultValue={resourcesToText(editingProduct?.metadata)}
                rows={4}
                placeholder={"Ví dụ:\nuser1|pass1\nkey-xxxxx-xxxxx"}
              />
            </label>
            <div className="seller-product-editor__row">
              <label>
                Giá (VND)
                <input name="price" type="number" min={1} defaultValue={editingProduct?.price} required />
              </label>
              <label>
                Tồn kho
                <input name="stock" type="number" min={0} defaultValue={editingProduct?.stock ?? 1} />
              </label>
            </div>
            <div className="seller-product-editor__row">
              <label>
                Loại
                <select name="type" defaultValue={editingProduct?.type ?? "ACCOUNT"}>
                  <option value="ACCOUNT">Tài khoản</option>
                  <option value="KEY">Key</option>
                  <option value="FILE">File</option>
                </select>
              </label>
              <label>
                Danh mục
                <select name="categoryId" defaultValue={editingProduct?.categoryId ?? firstCategoryId} required>
                  {categories.length ? (
                    categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Chưa có danh mục hoạt động
                    </option>
                  )}
                </select>
              </label>
            </div>
            <div className="seller-image-picker">
              <p>Ảnh sản phẩm (chọn từ album, tối đa 12 ảnh)</p>
              <label className="seller-image-picker__input">
                <ImagePlus size={16} />
                Chọn ảnh
                <input type="file" accept="image/*" multiple onChange={handlePickImages} />
              </label>

              {existingImages.length || selectedImagePreviews.length ? (
                <div className="seller-image-grid">
                  {existingImages.map((imageUrl, index) => (
                    <article key={`existing-${index}`} className="seller-image-grid__item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={`Ảnh sản phẩm ${index + 1}`} />
                      <button type="button" onClick={() => removeExistingImage(index)} aria-label="Xóa ảnh">
                        <X size={14} />
                      </button>
                    </article>
                  ))}
                  {selectedImagePreviews.map((previewUrl, index) => (
                    <article key={`picked-${index}`} className="seller-image-grid__item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt={`Ảnh mới ${index + 1}`} />
                      <button type="button" onClick={() => removePickedImage(index)} aria-label="Xóa ảnh mới">
                        <X size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="seller-product-editor__actions">
              <button
                type="submit"
                className={`seller-plan-btn seller-plan-btn--primary ${editingProduct ? "" : "seller-product-editor__submit--full"}`}
                disabled={categories.length === 0}
              >
                {editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}
              </button>
              {editingProduct ? (
                <button type="button" className="seller-plan-btn seller-plan-btn--ghost" onClick={() => setEditingProduct(null)}>
                  Hủy sửa
                </button>
              ) : null}
            </div>
          </form>

          <div className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
            <div className="flex items-center gap-[14px] mb-5">
              <BarChart3 size={20} />
              <h2>Sản phẩm của bạn</h2>
            </div>

            {products.length ? (
              <>
                <div className="seller-product-toolbar">
                  <span className="seller-product-toolbar__count">
                    <strong>{filteredProducts.length}</strong>/{products.length} sản phẩm
                  </span>
                  <label className="seller-product-toolbar__search">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hoặc danh mục..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery ? (
                      <button type="button" onClick={() => setSearchQuery("")} className="text-secondary hover:text-primary">
                        <X size={14} />
                      </button>
                    ) : null}
                  </label>
                  <SlidersHorizontal size={14} className="text-secondary shrink-0" />
                  <select
                    className="seller-product-toolbar__sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  >
                    <option value="name">Tên A-Z</option>
                    <option value="price">Giá</option>
                    <option value="stock">Tồn kho</option>
                    <option value="status">Trạng thái</option>
                  </select>
                </div>

                {filteredProducts.length ? (() => {
                  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
                  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                  return (
                  <>
                  <div className="seller-product-list">
                    {pageProducts.map((product, index) => {
                      const stockPct = product.stock <= 0 ? 0 : Math.min(100, Math.max(10, (product.stock / 50) * 100));
                      const stockBarClass =
                        product.stock <= 0
                          ? "seller-product-row__stock-bar is-out"
                          : product.stock < 5
                            ? "seller-product-row__stock-bar is-low"
                            : "seller-product-row__stock-bar";

                      let statusVariant = "secondary";
                      if (product.status === "APPROVED" || product.status === "ACTIVE") statusVariant = "success";
                      else if (product.status === "PENDING") statusVariant = "warning";
                      else if (product.status === "REJECTED" || product.status === "INACTIVE") statusVariant = "danger";

                      return (
                        <article
                          key={product.id}
                          className="seller-product-row"
                          style={
                            {
                              "--row-delay": `${index * 45}ms`,
                              "--stock-level": `${stockPct}%`,
                            } as React.CSSProperties
                          }
                        >
                          <div className="seller-product-row__thumb">
                            {product.images[0] ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={product.images[0]} alt={product.name} />
                            ) : (
                              <PackageOpen size={22} />
                            )}
                          </div>
                          <div className="seller-product-row__body">
                            <strong>{product.name}</strong>
                            <div className="seller-product-row__meta">
                              {product.categoryName ? <span>{product.categoryName}</span> : null}
                              <span>{product.type === "ACCOUNT" ? "Tài khoản" : product.type === "KEY" ? "Key" : "File"}</span>
                            </div>
                          </div>
                          <div className="seller-product-row__price">
                            {formatCurrency(product.price)}
                          </div>
                          <div className="seller-product-row__stock">
                            <small>{product.stock > 0 ? `Còn ${product.stock}` : "Hết hàng"}</small>
                            <div className={stockBarClass}>
                              <span />
                            </div>
                          </div>
                          <div>
                            <span className={`seller-product-status seller-product-status--${statusVariant}`}>
                              {statusLabel(product.status)}
                            </span>
                          </div>
                          <div className="seller-product-actions">
                            <button type="button" onClick={() => setEditingProduct(product)} title="Sửa">
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="is-danger" onClick={() => deleteProduct(product)} title="Xóa">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="seller-pagination">
                      <button
                        type="button"
                        className="seller-pagination__btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="Trang trước"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce<(number | "…")[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, i) =>
                          item === "…" ? (
                            <span key={`ellipsis-${i}`} className="seller-pagination__ellipsis">…</span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              className={`seller-pagination__btn${item === page ? " is-active" : ""}`}
                              onClick={() => setPage(item as number)}
                            >
                              {item}
                            </button>
                          )
                        )}
                      <button
                        type="button"
                        className="seller-pagination__btn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        aria-label="Trang tiếp"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <span className="seller-pagination__info">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProducts.length)} / {filteredProducts.length}
                      </span>
                    </div>
                  )}
                  </>);
                })() : (
                  <div className="seller-product-empty">
                    <span className="seller-product-empty__icon">
                      <Search size={24} />
                    </span>
                    <strong className="text-[15px] font-extrabold text-primary block">Không tìm thấy sản phẩm</strong>
                    <p>Không có sản phẩm nào khớp với &quot;{searchQuery}&quot;</p>
                    <button type="button" className="seller-plan-btn seller-plan-btn--ghost" onClick={() => setSearchQuery("")}>
                      Xóa bộ lọc
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="seller-product-empty">
                <span className="seller-product-empty__icon">
                  <PackageOpen size={28} />
                </span>
                <strong className="text-[15px] font-extrabold text-primary block">Chưa có sản phẩm nào</strong>
                <p>Tạo sản phẩm đầu tiên để bắt đầu bán trên marketplace.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] p-[clamp(20px,2.6vw,28px)] w-full">
          <div className="flex items-center gap-[14px] mb-4">
            <ReceiptText size={20} />
            <h2>Đơn hàng ({orders.length})</h2>
          </div>

          {orders.length === 0 ? (
            <div className="seller-product-empty">
              <span className="seller-product-empty__icon"><ReceiptText size={24} /></span>
              <strong className="text-[15px] font-extrabold text-primary block">Chưa có đơn hàng nào</strong>
              <p>Đơn hàng sẽ xuất hiện ở đây khi khách mua sản phẩm của bạn.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Sản phẩm</th>
                    <th>Người mua</th>
                    <th>Doanh thu</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const item = order.items?.[0];
                    const productName = item?.product?.name ?? "—";
                    const sellerRevenue = item ? Number(item.price) * (item.quantity ?? 1) : Number(order.totalAmount);
                    const rowKey = item?.id ?? `order-${order.id}`;
                    const orderDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString("vi-VN")
                      : "—";
                    return (
                      <tr key={rowKey}>
                        <td>#{order.id}</td>
                        <td>{productName}</td>
                        <td>{order.user?.email ?? order.user?.name ?? "Người mua"}</td>
                        <td>{formatCurrency(sellerRevenue)}</td>
                        <td>{orderDate}</td>
                        <td>{statusLabel(order.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "payouts" ? (
        <DashboardTable icon={<Wallet size={20} />} title="Thanh toán">
          {payouts.map((payout) => (
            <tr key={payout.id}>
              <td>#{payout.id}</td>
              <td>{formatCurrency(payout.amount)}</td>
              <td>{statusLabel(payout.status)}</td>
              <td>{payout.createdAt ? new Date(payout.createdAt).toLocaleDateString("vi-VN") : "-"}</td>
            </tr>
          ))}
        </DashboardTable>
      ) : null}

      {activeTab === "plans" ? (
        <section className="dashboard-grid dashboard-grid--editor">
          <div className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
            <div className="flex items-center gap-[14px] mb-4">
              <Wallet size={20} />
              <h2>Subscription của bạn</h2>
            </div>
            {mySubscription ? (
              <div className="grid gap-3.5">
                <div>
                  <strong>{mySubscription.plan.name}</strong>
                  <span>{statusLabel(mySubscription.status)} · {formatCurrency(mySubscription.plan.price)}</span>
                </div>
                <div>
                  <span>Từ {new Date(mySubscription.startDate).toLocaleDateString("vi-VN")} đến {new Date(mySubscription.endDate).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>
            ) : (
              <p>Bạn chưa đăng ký plan nào.</p>
            )}
          </div>
          <div className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
            <div className="flex items-center gap-[14px] mb-4">
              <Wallet size={20} />
              <h2>Gói hiện có</h2>
            </div>
            <div className="w-full overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Giá</th>
                    <th>Thời hạn</th>
                    <th>Max SP</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                        {plan.description ? <p>{plan.description}</p> : null}
                      </td>
                      <td>{formatCurrency(plan.price)}</td>
                      <td>{plan.durationDays} ngày</td>
                      <td>{plan.maxProducts ?? "Không giới hạn"}</td>
                      <td>
                        <button
                          type="button"
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary"
                          disabled={mySubscription?.planId === plan.id}
                          onClick={() => subscribeToPlan(plan.id)}
                        >
                          {mySubscription?.planId === plan.id ? "Hiện tại" : "Đăng ký"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className="dashboard-grid dashboard-grid--editor">
          <form className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] grid gap-3.5" onSubmit={savePaymentConfig}>
            <div className="flex items-center gap-[14px] mb-4">
              <CreditCard size={20} />
              <h2>Thêm cấu hình thanh toán</h2>
            </div>
            <label>
              Phương thức
              <select name="method" defaultValue="BANK_TRANSFER">
                <option value="BANK_TRANSFER">Chuyển khoản</option>
                <option value="MOMO">MoMo</option>
                <option value="SEPAY">SePay</option>
                <option value="PAYPAL">PayPal</option>
              </select>
            </label>
            <label>
              Tài khoản / cấu hình
              <input name="account" placeholder="Số tài khoản, mã gian hàng..." />
            </label>
            <label>
              Ghi chú
              <textarea name="note" rows={3} />
            </label>
            <button type="submit" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">Lưu config</button>
          </form>
          <div className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
            <div className="flex items-center gap-[14px] mb-4">
              <CreditCard size={20} />
              <h2>Cấu hình hiện có</h2>
            </div>
            <div className="grid gap-3.5">
              {paymentConfigs.map((config) => (
                <div key={config.id}>
                  <strong>{config.method}</strong>
                  <span>{config.isActive ? "Đang bật" : "Đang tắt"}</span>
                </div>
              ))}
              {!paymentConfigs.length ? <p>Chưa có config.</p> : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function DashboardTable({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
      <div className="flex items-center gap-[14px] mb-4">
        {icon}
        <h2>{title}</h2>
      </div>
      <div className="w-full overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Người dùng</th>
              <th>Giá trị</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
