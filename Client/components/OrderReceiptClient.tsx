"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  MailCheck,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";
import {
  formatCurrency,
  paymentMethodLabel,
  safeImageUrls,
  statusLabel,
  type ApiEnvelope,
  type ApiList,
  type AppNotification,
  type Order,
} from "@/lib/api";

type DeliveryFile = {
  name?: string;
  url?: string;
  size?: number;
};

type DeliveryField = {
  label?: string;
  value?: string;
};

type DeliveryEntry = {
  type?: string;
  credentials?: string;
  keys?: string[];
  files?: DeliveryFile[];
  fields?: DeliveryField[];
};

type DeliveryMap = Record<string, DeliveryEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCredentialText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  if (
    normalized.includes("sent to email") ||
    normalized.includes("check email") ||
    normalized.includes("gửi về email") ||
    normalized.includes("kiem tra email")
  ) {
    return undefined;
  }
  return trimmed;
}

function parseDeliveryMap(value: unknown): DeliveryMap | null {
  if (!isRecord(value)) return null;

  const parsed: DeliveryMap = {};
  Object.entries(value).forEach(([productId, entry]) => {
    if (!isRecord(entry)) return;
    const keys = Array.isArray(entry.keys) ? entry.keys.filter((item): item is string => typeof item === "string") : [];
    const files = Array.isArray(entry.files)
      ? entry.files
          .filter((item) => isRecord(item))
          .map((item) => ({
            name: typeof item.name === "string" ? item.name : undefined,
            url: typeof item.url === "string" ? item.url : undefined,
            size: typeof item.size === "number" ? item.size : undefined,
          }))
      : [];
    const fields = Array.isArray(entry.fields)
      ? entry.fields
          .filter((item) => isRecord(item))
          .map((item) => ({
            label: typeof item.label === "string" ? item.label : undefined,
            value: typeof item.value === "string" ? item.value : undefined,
          }))
          .filter((item) => item.label && item.value)
      : [];

    parsed[productId] = {
      type: typeof entry.type === "string" ? entry.type : undefined,
      credentials: normalizeCredentialText(entry.credentials),
      keys,
      files,
      fields,
    };
  });

  return Object.keys(parsed).length ? parsed : null;
}

function extractDeliveryFromNotifications(notifications: AppNotification[], orderId: number): DeliveryMap | null {
  for (const notification of notifications) {
    if (!isRecord(notification.metadata)) continue;
    const metadataOrderId = Number(notification.metadata.orderId);
    if (metadataOrderId !== orderId) continue;
    return parseDeliveryMap(notification.metadata.deliveryData);
  }
  return null;
}

function statusTone(status: string) {
  if (status === "DELIVERED") return "border-success/35 bg-success/10 text-success";
  if (status === "DELIVERING" || status === "PAID") return "border-border bg-neutral text-primary";
  if (status === "FAILED" || status === "CANCELLED") return "border-danger/35 bg-danger/10 text-danger";
  return "border-border bg-neutral text-secondary";
}

function fileSizeLabel(size?: number) {
  if (!size || size <= 0) return null;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

type OrderReceiptClientProps = {
  orderId: number;
};

function deliveryFieldLabel(key: string) {
  const normalized = key.toLowerCase().replace(/[_\s-]+/g, "");
  const labels: Record<string, string> = {
    email: "Email",
    username: "Username",
    user: "Username",
    login: "Đăng nhập",
    loginid: "Đăng nhập",
    password: "Mật khẩu",
    pass: "Mật khẩu",
    pin: "PIN",
    otp: "OTP",
    code: "Mã",
    key: "Key",
    licensekey: "License key",
    profile: "Profile",
    plan: "Gói",
    package: "Gói",
    note: "Ghi chú",
    url: "Link",
    loginurl: "Link đăng nhập",
    website: "Website",
    server: "Server",
    region: "Khu vực",
  };
  return labels[normalized] ?? key;
}

function deliveryFieldValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value.map((item) => deliveryFieldValue(item)).filter((item): item is string => Boolean(item));
    return values.length ? values.join(", ") : undefined;
  }
  return undefined;
}

function collectDeliveryFields(
  value: unknown,
  fields: DeliveryField[],
  seen = new Set<string>(),
) {
  if (!isRecord(value)) return;

  Object.entries(value).forEach(([key, rawValue]) => {
    if (isRecord(rawValue)) {
      collectDeliveryFields(rawValue, fields, seen);
      return;
    }

    const text = deliveryFieldValue(rawValue);
    if (!text) return;
    const signature = `${key}:${text}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    fields.push({ label: deliveryFieldLabel(key), value: text });
  });
}

function fallbackDeliveryFromProduct(product: Order["items"][number]["product"] | undefined): DeliveryEntry | null {
  if (!product?.type || !isRecord(product.metadata)) return null;

  if (product.type === "ACCOUNT") {
    const fields: DeliveryField[] = [];
    const seen = new Set<string>();
    [
      product.metadata.credentials,
      product.metadata.account,
      product.metadata.accountInfo,
      product.metadata.accountDetails,
      product.metadata.deliveryInfo,
      product.metadata.deliveryData,
      product.metadata.resourceInfo,
      product.metadata.resource,
      product.metadata.login,
      product.metadata.details,
      product.metadata,
    ].forEach((entry) => collectDeliveryFields(entry, fields, seen));

    return {
      type: "ACCOUNT",
      credentials:
        normalizeCredentialText(product.metadata.credentials) ??
        normalizeCredentialText(product.metadata.accountCredentials) ??
        normalizeCredentialText(product.metadata.accountText) ??
        normalizeCredentialText(product.metadata.deliveryText),
      fields,
    };
  }

  if (product.type === "KEY") {
    const keys = Array.isArray(product.metadata.keys)
      ? product.metadata.keys.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const singleKey =
      (typeof product.metadata.licenseKey === "string" && product.metadata.licenseKey.trim()) ||
      (typeof product.metadata.key === "string" && product.metadata.key.trim()) ||
      (typeof product.metadata.activationKey === "string" && product.metadata.activationKey.trim()) ||
      undefined;

    if (!keys.length && !singleKey) return null;
    return {
      type: "KEY",
      keys: keys.length ? keys : singleKey ? [singleKey] : [],
    };
  }

  return null;
}

function mergeDeliveryEntry(primary: DeliveryEntry | null, fallback: DeliveryEntry | null): DeliveryEntry | null {
  if (!primary) return fallback;
  if (!fallback) return primary;

  return {
    type: primary.type ?? fallback.type,
    credentials: primary.credentials ?? fallback.credentials,
    keys: primary.keys && primary.keys.length > 0 ? primary.keys : fallback.keys,
    files: primary.files && primary.files.length > 0 ? primary.files : fallback.files,
    fields: primary.fields && primary.fields.length > 0 ? primary.fields : fallback.fields,
  };
}

export function OrderReceiptClient({ orderId }: OrderReceiptClientProps) {
  const { isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { orderUpdates } = useRealtime();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryMap, setDeliveryMap] = useState<DeliveryMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchOrderData = useCallback(async (showBusyState: boolean) => {
    if (!isAuthenticated) return;
    if (showBusyState) setIsRefreshing(true);
    setErrorText(null);

    try {
      const [orderResponse, notificationResponse] = await Promise.all([
        apiFetch<ApiEnvelope<Order>>(`/orders/${orderId}`, { notifySuccess: false }),
        apiFetch<ApiList<AppNotification>>("/users/me/notifications?limit=50", { notifySuccess: false }),
      ]);
      setOrder(orderResponse.data);
      const nextDelivery = extractDeliveryFromNotifications(notificationResponse.data ?? [], orderId);
      if (nextDelivery) {
        setDeliveryMap(nextDelivery);
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Không thể tải thông tin đơn hàng.");
    } finally {
      setIsLoading(false);
      if (showBusyState) setIsRefreshing(false);
    }
  }, [apiFetch, isAuthenticated, orderId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    void fetchOrderData(false);
  }, [fetchOrderData, isAuthenticated]);

  const liveStatus = useMemo(() => {
    if (!order) return null;
    return orderUpdates[order.id] ?? order.status;
  }, [order, orderUpdates]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!order) return;

    const shouldKeepRefreshing =
      (liveStatus !== "DELIVERED" && liveStatus !== "FAILED" && liveStatus !== "CANCELLED") ||
      !deliveryMap;
    if (!shouldKeepRefreshing) return;

    const timer = window.setInterval(() => {
      void fetchOrderData(false);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [deliveryMap, fetchOrderData, isAuthenticated, liveStatus, order]);

  if (isInitializing || isLoading) {
    return (
      <main className="px-inline py-block">
        <section className="mx-auto max-w-[1080px]">
          <div className="skeleton-panel h-[340px] rounded-[24px]" />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem chi tiết đơn hàng và nhận tài nguyên.</p>
          <Link href={`/login?next=/order/${orderId}/success`} className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="px-inline py-block">
        <section className="mx-auto max-w-[880px] rounded-[24px] border border-danger/30 bg-danger/10 p-6 text-center">
          <h1 className="mb-2">Không tìm thấy đơn hàng</h1>
          <p className="m-0 text-secondary">{errorText ?? "Đơn hàng không tồn tại hoặc bạn không có quyền truy cập."}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/account/orders" className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-extrabold text-primary">
              Về đơn hàng của tôi
            </Link>
            <button
              type="button"
              onClick={() => void fetchOrderData(true)}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-tertiary/35 bg-tertiary/10 px-4 text-sm font-extrabold text-primary"
            >
              <RefreshCw size={14} />
              Tải lại
            </button>
          </div>
        </section>
      </main>
    );
  }

  const orderStatus = liveStatus ?? order.status;
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveredCount = order.items.filter((item) => deliveryMap?.[String(item.productId)]).length;
  const deliveryPercent = order.items.length ? Math.round((deliveredCount / order.items.length) * 100) : 0;

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(value);
      showToast("Đã copy key.", "success");
      window.setTimeout(() => setCopiedKey((current) => (current === value ? null : current)), 1500);
    } catch {
      showToast("Không thể copy key.", "error");
    }
  }

  return (
    <main className="px-inline py-[clamp(32px,5vw,64px)]">
      <section className="mx-auto grid max-w-[1080px] gap-4">
        <article className="overflow-hidden rounded-[28px] border border-card-border bg-surface p-[clamp(20px,3vw,34px)] shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3 text-[11px] font-black uppercase tracking-wide text-success">
                  <CheckCircle2 size={14} />
                  Thanh toán thành công
                </span>
                <span className={`inline-flex min-h-[30px] items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wide ${statusTone(orderStatus)}`}>
                  {statusLabel(orderStatus)}
                </span>
              </div>

              <h1 className="m-0 max-w-[760px] text-[clamp(34px,5vw,56px)] leading-[1.03] tracking-normal">
                Nhận tài nguyên đơn #{order.id}
              </h1>
              <p className="m-0 mt-3 max-w-[60ch] text-[15px] font-semibold leading-7 text-secondary">
                Khi sản phẩm được bàn giao, key, account hoặc file sẽ xuất hiện ngay trong danh sách bên dưới.
              </p>

              <div className="mt-7 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 text-[12px] font-black text-primary">
                    <span>{deliveredCount}/{order.items.length} tài nguyên</span>
                    <span>{deliveryPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full border border-border bg-neutral">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-medium"
                      style={{ width: `${deliveryPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/account/orders" className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[13px] border border-border bg-neutral px-3 text-[12px] font-extrabold text-primary transition-all hover:-translate-y-[1px] hover:border-tertiary/35">
                    <PackageCheck size={14} />
                    Đơn hàng
                  </Link>
                  <Link href="/account/notifications" className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[13px] border border-border bg-surface px-3 text-[12px] font-extrabold text-primary transition-all hover:-translate-y-[1px] hover:border-tertiary/35">
                    <MailCheck size={14} />
                    Thông báo
                  </Link>
                  <button
                    type="button"
                    onClick={() => void fetchOrderData(true)}
                    className="inline-flex min-h-[38px] w-[40px] items-center justify-center rounded-[13px] border border-border bg-surface text-secondary transition-all hover:text-primary disabled:opacity-60"
                    disabled={isRefreshing}
                    aria-label="Làm mới dữ liệu"
                  >
                    {isRefreshing ? <LoaderCircle size={14} className="spin-icon" /> : <RefreshCw size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <aside className="rounded-[22px] border border-border bg-neutral p-4">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="grid h-11 w-11 place-items-center rounded-[14px] border border-border bg-surface text-primary">
                  <ShieldCheck size={20} />
                </div>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-black uppercase tracking-wide text-secondary">
                  #{order.id}
                </span>
              </div>
              <dl className="grid gap-3">
                <div className="grid gap-1">
                  <dt>Tổng thanh toán</dt>
                  <dd className="truncate text-[18px]">{formatCurrency(order.totalAmount)}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[14px] border border-border bg-surface px-3 py-2">
                    <dt>Số lượng</dt>
                    <dd className="text-[15px]">{totalQuantity}</dd>
                  </div>
                  <div className="rounded-[14px] border border-border bg-surface px-3 py-2">
                    <dt>Thanh toán</dt>
                    <dd className="truncate text-[15px]">{paymentMethodLabel(order.paymentMethod)}</dd>
                  </div>
                </div>
              </dl>
            </aside>
          </div>
        </article>

        <article className="rounded-[26px] border border-card-border bg-surface p-[clamp(16px,2.5vw,24px)] shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-[14px] border border-border bg-neutral text-primary">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="m-0 text-[20px] font-black text-primary">Tài nguyên bàn giao</h2>
                <p className="m-0 text-[12px] font-bold text-secondary">Key, account và file theo từng sản phẩm trong đơn.</p>
              </div>
            </div>
            <span className={`inline-flex min-h-[30px] items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wide ${statusTone(orderStatus)}`}>
              {statusLabel(orderStatus)}
            </span>
          </div>

          {errorText ? (
            <p className="mb-3 rounded-[12px] border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">{errorText}</p>
          ) : null}

          {order.items.map((item) => {
            const product = item.product;
            const images = safeImageUrls(product?.images);
            const resource = mergeDeliveryEntry(
              deliveryMap?.[String(item.productId)] ?? null,
              fallbackDeliveryFromProduct(product),
            );
            const isReady = Boolean(resource);

            return (
              <div key={item.id} className="mb-3 grid gap-3 rounded-[22px] border border-border bg-neutral p-3 transition-all duration-medium hover:-translate-y-[1px] hover:border-tertiary/25 md:grid-cols-[76px_minmax(0,1fr)] md:items-start">
                <div className="grid h-[76px] w-[76px] place-items-center overflow-hidden rounded-[16px] border border-border bg-surface">
                  {images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[0]} alt={product?.name ?? `Sản phẩm ${item.productId}`} className="h-full w-full object-cover" />
                  ) : (
                    <PackageCheck size={20} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <strong className="min-w-0 break-words text-[15px] font-black text-primary">{product?.name ?? `Sản phẩm #${item.productId}`}</strong>
                    <span className="inline-flex min-h-[22px] items-center rounded-full border border-border bg-surface px-2 text-[10px] font-black uppercase tracking-wide text-secondary">
                      SL {item.quantity}
                    </span>
                    <span className={`inline-flex min-h-[22px] items-center rounded-full border px-2 text-[10px] font-black uppercase tracking-wide ${isReady ? "border-success/25 bg-success/10 text-success" : "border-border bg-surface text-secondary"}`}>
                      {isReady ? "Sẵn sàng nhận" : "Đang chuẩn bị"}
                    </span>
                  </div>

                  {resource ? (
                    <div className="grid gap-2">
                      {resource.type === "ACCOUNT" ? (
                        <div className="rounded-[12px] border border-border bg-surface p-2.5 text-[12px] font-semibold text-primary">
                          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-secondary">
                            <MailCheck size={13} />
                            Thông tin tài nguyên
                          </div>
                          {resource.fields && resource.fields.length > 0 ? (
                            <div className="grid gap-1.5">
                              {resource.fields.map((field, index) => (
                                <div key={`${item.id}-field-${index}`} className="grid gap-1 rounded-[10px] border border-border bg-neutral px-2.5 py-2">
                                  <span className="text-[10px] font-black uppercase tracking-wide text-secondary">{field.label}</span>
                                  <code className="break-all text-[12px] font-bold text-primary">{field.value}</code>
                                </div>
                              ))}
                              {resource.credentials ? (
                                <p className="m-0 rounded-[10px] border border-border bg-neutral px-2.5 py-2 whitespace-pre-wrap break-words text-primary">
                                  {resource.credentials}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="m-0 whitespace-pre-wrap break-words">{resource.credentials ?? "Thông tin tài khoản đã được đồng bộ trực tiếp trong đơn hàng."}</p>
                          )}
                        </div>
                      ) : null}

                      {resource.keys && resource.keys.length > 0 ? (
                        <div className="rounded-[12px] border border-border bg-surface p-2.5">
                          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-secondary">
                            <KeyRound size={13} />
                            License keys
                          </div>
                          {resource.keys.map((keyValue, index) => (
                            <div key={`${item.id}-key-${index}`} className="mb-1 grid gap-2 rounded-[10px] border border-border bg-surface p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <code className="min-w-0 break-all text-[12px] font-bold text-primary">{keyValue}</code>
                              <button
                                type="button"
                                onClick={() => void copyKey(keyValue)}
                                className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-full border border-border bg-neutral px-3 text-[11px] font-black text-primary transition-all hover:border-tertiary/40 hover:text-tertiary"
                                aria-label="Copy license key"
                              >
                                {copiedKey === keyValue ? <ClipboardCheck size={13} /> : <Clipboard size={13} />}
                                {copiedKey === keyValue ? "Đã copy" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {resource.files && resource.files.length > 0 ? (
                        <div className="rounded-[12px] border border-border bg-surface p-2.5">
                          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-primary">
                            <Download size={13} />
                            Tệp đính kèm
                          </div>
                          <div className="grid gap-1.5">
                            {resource.files.map((file, index) => (
                              file.url ? (
                                <a
                                  key={`${item.id}-file-${index}`}
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-between gap-2 rounded-md border border-border bg-neutral px-2 py-1.5 text-[12px] font-bold text-primary hover:border-tertiary/40 hover:text-tertiary"
                                >
                                  <span className="truncate">{file.name || `Tệp #${index + 1}`}</span>
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-secondary">
                                    {fileSizeLabel(file.size) ?? "Mở tệp"}
                                    <ExternalLink size={12} />
                                  </span>
                                </a>
                              ) : (
                                <span
                                  key={`${item.id}-file-${index}`}
                                  className="inline-flex items-center justify-between gap-2 rounded-md border border-border bg-neutral px-2 py-1.5 text-[12px] font-bold text-secondary"
                                >
                                  <span className="truncate">{file.name || `Tệp #${index + 1}`}</span>
                                  <span className="shrink-0 text-[11px]">Đang cập nhật link</span>
                                </span>
                              )
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2 text-[12px] font-bold text-secondary">
                      <Clock3 size={13} />
                      Tài nguyên đang được chuẩn bị. Hệ thống sẽ tự đồng bộ khi bàn giao xong.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </article>
      </section>
    </main>
  );
}
