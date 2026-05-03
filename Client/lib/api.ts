import { products as fallbackProducts, formatPrice as legacyFormatPrice } from "@/lib/catalog";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000/api";
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const PRODUCT_CACHE_REVALIDATE_SECONDS = 60;
const CATEGORY_CACHE_REVALIDATE_SECONDS = 5 * 60;
const REVIEW_CACHE_REVALIDATE_SECONDS = 120;

export type RequestJsonInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
  notifySuccess?: boolean;
  successMessage?: string;
};

export const APP_TOAST_EVENT = "app:toast";

type AppToastDetail = {
  text: string;
  type?: "success" | "error" | "info";
};

function emitAppToast(detail: AppToastDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail }));
}

export type Role = "USER" | "SELLER" | "ADMIN";
export type ProductType = "ACCOUNT" | "KEY" | "FILE";
export type ProductStatus = "PENDING" | "APPROVED" | "REJECTED" | "ACTIVE" | "INACTIVE" | "DELETED";
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "PAID"
  | "FAILED"
  | "DELIVERING";
export type PaymentMethod = "PLATFORM" | "MOMO" | "SEPAY" | "PAYPAL" | "BANK_TRANSFER";

export type TransactionType = "DEPOSIT" | "PAYMENT" | "REFUND" | "SELLER_REVENUE";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export type WalletTransaction = {
  id: number;
  userId: number;
  amount: string | number;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod?: PaymentMethod | null;
  referenceId?: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type WalletData = {
  balance: number;
  totalDeposits: number;
  totalPayments: number;
};

export type ApiList<T> = {
  success: boolean;
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar?: string | null;
  phone?: string | null;
  bio?: string | null;
  address?: string | null;
  balance?: number;
  isActive?: boolean;
  isEmailVerified?: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  parentId?: number | null;
  isActive?: boolean;
  _count?: { products?: number; children?: number };
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
  stock: number;
  status: ProductStatus;
  images: string[];
  categoryId?: number | null;
  categoryName?: string;
  sellerId?: number;
  sellerName?: string;
  viewCount: number;
  soldCount: number;
  rating: number;
  reviewsCount: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type AppNotification = {
  id: number;
  userId: number;
  title: string;
  content: string;
  type: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type CartItem = {
  id: number;
  productId: number;
  quantity: number;
  product: StoreProduct;
};

export type OrderItem = {
  id: number;
  productId: number;
  sellerId?: number | null;
  quantity: number;
  price: string | number;
  product?: Partial<StoreProduct> & { id: number; name: string; images?: unknown };
};

export type Order = {
  id: number;
  userId: number;
  totalAmount: string | number;
  platformFee?: string | number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  user?: Pick<User, "id" | "name" | "email">;
};

export type PaymentMethodOption = {
  id: PaymentMethod;
  name: string;
  icon?: string;
};

export type Review = {
  id: number;
  rating: number;
  content: string;
  createdAt: string;
  user?: Pick<User, "id" | "name" | "avatar">;
};

export type ReviewStats = {
  averageRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type ReviewListData = {
  data: Review[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
  stats?: ReviewStats;
};

export type DashboardStats = Record<string, unknown>;

export type BackendProduct = {
  id: number;
  slug?: string;
  name: string;
  description?: string | null;
  price: string | number;
  images?: unknown;
  type?: ProductType;
  stock?: number;
  status?: ProductStatus;
  categoryId?: number | null;
  category?: { id?: number; name?: string; slug?: string } | null;
  sellerId?: number;
  seller?: { id?: number; name?: string } | null;
  viewCount?: number;
  soldCount?: number;
  averageRating?: number;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
  _count?: { reviews?: number; orderItems?: number };
};

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function formatCurrency(value: string | number) {
  return legacyFormatPrice(Number(value) || 0);
}

export function productTypeLabel(type: ProductType) {
  return type === "ACCOUNT" ? "Tài khoản" : type === "KEY" ? "Key" : "File";
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Đang chờ",
    CONFIRMED: "Đã xác nhận",
    PROCESSING: "Đang xử lý",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    DELIVERING: "Đang bàn giao",
    CANCELLED: "Đã hủy",
    REFUNDED: "Đã hoàn",
    PAID: "Đã thanh toán",
    FAILED: "Thất bại",
    APPROVED: "Đã duyệt",
    REJECTED: "Bị từ chối",
    ACTIVE: "Đang bật",
    INACTIVE: "Đang tắt",
  };
  return labels[status] ?? status;
}

export function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    PLATFORM: "Ví web",
    MOMO: "MoMo",
    SEPAY: "SePay",
    PAYPAL: "PayPal",
    BANK_TRANSFER: "Chuyển khoản ngân hàng",
  };
  return labels[method] ?? method;
}

export function isNumericId(value: string) {
  return /^\d+$/.test(value);
}

export function safeImageUrls(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {}
  }
  const raw = Array.isArray(value) ? value : [];
  return raw.filter((item): item is string => {
    if (typeof item !== "string") {
      return false;
    }
    try {
      const url = new URL(item);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return item.startsWith("/");
    }
  });
}

export function normalizeProduct(product: BackendProduct): StoreProduct {
  const metadata =
    product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata)
      ? (product.metadata as Record<string, unknown>)
      : {};

  return {
    id: String(product.id),
    slug: product.slug || String(product.id),
    name: product.name,
    description: product.description || "Sản phẩm số được kiểm tra và bàn giao qua hệ thống.",
    price: Number(product.price) || 0,
    type: product.type || "ACCOUNT",
    stock: product.stock ?? 0,
    status: product.status || "APPROVED",
    images: safeImageUrls(product.images),
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: product.category?.name,
    sellerId: product.sellerId ?? product.seller?.id,
    sellerName: product.seller?.name,
    viewCount: product.viewCount ?? 0,
    soldCount: product.soldCount ?? product._count?.orderItems ?? 0,
    rating: Number(product.averageRating) || 0,
    reviewsCount: product._count?.reviews ?? 0,
    metadata,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export const fallbackStoreProducts: StoreProduct[] = fallbackProducts.map((product, index) => ({
  id: product.slug,
  slug: product.slug,
  name: product.title,
  description: product.description,
  price: product.price,
  type: product.type === "account" ? "ACCOUNT" : "KEY",
  stock: product.stock,
  status: "APPROVED",
  images: [],
  categoryId: product.type === "account" ? 1 : 2,
  categoryName: product.type === "account" ? "Account" : "API key",
  sellerName: "Dora MARKETPLACE",
  viewCount: 320 + index * 41,
  soldCount: 24 + index * 8,
  rating: 4.7,
  reviewsCount: 12 + index,
  metadata: { badge: product.badge, delivery: product.delivery, warranty: product.warranty },
}));

export const fallbackCategories: Category[] = [
  { id: 1, name: "Account", slug: "account", _count: { products: 3 } },
  { id: 2, name: "API key", slug: "api-key", _count: { products: 2 } },
  { id: 3, name: "License", slug: "license", _count: { products: 1 } },
];

export async function requestJson<T>(
  path: string,
  init: RequestJsonInit = {},
  accessToken?: string | null,
): Promise<T> {
  const { notifySuccess, successMessage, ...fetchInit } = init;
  const isFormDataBody = typeof FormData !== "undefined" && fetchInit.body instanceof FormData;
  const headers = new Headers(fetchInit.headers);
  if (!headers.has("Content-Type") && fetchInit.body && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchInit,
      headers,
      credentials: "include",
      cache: fetchInit.cache ?? (fetchInit.next ? "force-cache" : "no-store"),
    });
  } catch (error) {
    throw new ApiError("Không thể kết nối máy chủ API.", 0, error);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Lỗi kết nối API (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  const method = String(fetchInit.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const isSilentPath = path.startsWith("/auth/refresh");
  const shouldNotify = typeof notifySuccess === "boolean" ? notifySuccess : isMutation;
  const responseMessage =
    payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message || "")
      : "";
  const alertMessage = successMessage ?? responseMessage;
  if (!isSilentPath && shouldNotify && alertMessage) {
    emitAppToast({ text: alertMessage, type: "success" });
  }

  return payload as T;
}

export function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function getProducts(params: Record<string, string | number | undefined> = {}) {
  try {
    const response = await requestJson<ApiList<BackendProduct>>(`/products${toQuery(params)}`, {
      next: {
        revalidate: PRODUCT_CACHE_REVALIDATE_SECONDS,
        tags: ["products"],
      },
    });
    return {
      products: response.data.map(normalizeProduct),
      pagination: response.pagination,
      isFallback: false,
    };
  } catch {
    const type = typeof params.type === "string" ? params.type : undefined;
    const search = typeof params.search === "string" ? params.search.toLowerCase() : "";
    const categoryId = params.categoryId !== undefined ? String(params.categoryId) : "";
    const requestedPage = Number(params.page);
    const requestedLimit = Number(params.limit);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 12;
    const filtered = fallbackStoreProducts.filter((product) => {
      const matchesType = !type || product.type === type;
      const matchesCategory = !categoryId || String(product.categoryId ?? "") === categoryId;
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      return matchesType && matchesCategory && matchesSearch;
    });
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pagedProducts = filtered.slice(start, start + limit);

    return {
      products: pagedProducts,
      pagination: { page: safePage, limit, total, totalPages },
      isFallback: true,
    };
  }
}

export async function getProduct(identifier: string) {
  if (isNumericId(identifier)) {
    try {
      const response = await requestJson<ApiEnvelope<BackendProduct>>(`/products/${identifier}`, {
        next: {
          revalidate: PRODUCT_CACHE_REVALIDATE_SECONDS,
          tags: ["products", `product:${identifier}`],
        },
      });
      return normalizeProduct(response.data);
    } catch {
      return fallbackStoreProducts.find((product) => product.id === identifier || product.slug === identifier) ?? null;
    }
  }

  return fallbackStoreProducts.find((product) => product.slug === identifier) ?? null;
}

export async function getCategories() {
  try {
    const response = await requestJson<ApiList<Category>>("/categories?limit=100&isActive=true&hasStock=true", {
      next: {
        revalidate: CATEGORY_CACHE_REVALIDATE_SECONDS,
        tags: ["categories"],
      },
    });
    return response.data;
  } catch {
    return fallbackCategories;
  }
}

export async function getReviews(productId: string) {
  if (!isNumericId(productId)) {
    return {
      data: [] as Review[],
      pagination: { page: 1, limit: 10, total: 0 },
      stats: {
        averageRating: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    } as ReviewListData;
  }
  try {
    const response = await requestJson<ApiEnvelope<ReviewListData>>(`/reviews/product/${productId}`, {
      next: {
        revalidate: REVIEW_CACHE_REVALIDATE_SECONDS,
        tags: ["reviews", `product:${productId}`],
      },
    });
    return response.data;
  } catch {
    return {
      data: [] as Review[],
      pagination: { page: 1, limit: 10, total: 0 },
      stats: {
        averageRating: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    } as ReviewListData;
  }
}
