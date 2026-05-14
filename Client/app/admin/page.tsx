"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Crown,
  Edit3,
  Headphones,
  Lock,
  LockOpen,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  API_BASE_URL,
  formatCurrency,
  normalizeProduct,
  statusLabel,
  type ApiEnvelope,
  type ApiList,
  type AppNotification,
  type BackendProduct,
  type Role,
  type StoreProduct,
  type User,
} from "@/lib/api";

function resolveAvatar(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  try {
    const origin = new URL(API_BASE_URL).origin;
    if (raw.startsWith("/api/")) return `${origin}${raw}`;
    if (raw.startsWith("/uploads/")) return `${origin}/api${raw}`;
  } catch {}
  return raw.startsWith("/") ? raw : `/${raw}`;
}
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

type Plan = {
  id: number | string;
  name: string;
  price: string | number;
  durationDays?: number;
  duration?: number;
  features?: string[] | unknown;
  isActive?: boolean;
};

type AdminUser = User & {
  createdAt?: string;
  isEmailVerified?: boolean;
  subscription?: Array<{
    id: number;
    status: string;
    endDate: string;
    plan?: Plan | null;
  }>;
  _count?: {
    products?: number;
    orders?: number;
  };
};

type ActivityLog = {
  id: number;
  action?: string;
  entity?: string;
  entityId?: number;
  ip?: string;
  metadata?: {
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
  };
  createdAt?: string;
  user?: Pick<User, "name" | "email" | "role">;
};

type DashboardOrder = {
  id: number;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  user?: Pick<User, "name" | "email">;
};

type DashboardStats = {
  users?: number;
  products?: number;
  orders?: number;
  revenue?: string | number;
  pendingProducts?: number;
  recentOrders?: DashboardOrder[];
};

type AdminGifPayload = {
  gifUrl: string | null;
  title: string;
  category: string;
  source: "nekos.best" | "fallback";
  cached?: boolean;
  width?: number | null;
  height?: number | null;
};

const tabs = ["overview", "users", "pending", "plans", "logs", "notifications"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  overview: "Tổng quan",
  users: "Người dùng",
  pending: "Kiểm duyệt",
  plans: "Gói seller",
  logs: "Nhật ký",
  notifications: "Thông báo",
};

function parseTab(value: string | null): Tab {
  const normalized = String(value || "").toLowerCase();
  if (tabs.includes(normalized as Tab)) return normalized as Tab;
  return "overview";
}

function numberValue(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateLabel(input?: string) {
  if (!input) return "--";
  return new Date(input).toLocaleString("vi-VN");
}

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "SELLER") return "Seller";
  return "Người dùng";
}

function AdminAvatar({ name, avatar }: { name?: string | null; avatar?: string | null }) {
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr ? null : resolveAvatar(avatar);
  const initials = (name || "U").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="admin-user-card__avatar">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ""}
          className="admin-user-card__avatar-img"
          onError={() => setImgErr(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isInitializing, apiFetch } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingProducts, setPendingProducts] = useState<StoreProduct[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<DashboardStats>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<Role | "ALL">("ALL");
  const [userStatusFilter, setUserStatusFilter] = useState<"ALL" | "ACTIVE" | "LOCKED">("ALL");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [grantingUser, setGrantingUser] = useState<AdminUser | null>(null);
  const [depositUser, setDepositUser] = useState<AdminUser | null>(null);
  const [adminNotifications, setAdminNotifications] = useState<AppNotification[]>([]);
  const [editingNotifId, setEditingNotifId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [broadcastRole, setBroadcastRole] = useState<"ALL" | "USER" | "SELLER" | "ADMIN">("ALL");
  const [notifFilter, setNotifFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [adminGif, setAdminGif] = useState<AdminGifPayload | null>(null);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const nextTab = parseTab(searchParams.get("tab"));
    setActiveTab(nextTab);
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      return;
    }
    loadAdminData();
    loadAdminGif();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin]);

  function setBusy(key: string, value: boolean) {
    setBusyMap((prev) => ({ ...prev, [key]: value }));
  }

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusy(key, true);
    try {
      await action();
    } finally {
      setBusy(key, false);
    }
  }

  async function loadAdminData() {
    setIsRefreshing(true);
    const [dashboardRes, usersRes, pendingRes, plansRes, logsRes, notifRes] = await Promise.allSettled([
      apiFetch<ApiEnvelope<DashboardStats>>("/admin/dashboard"),
      apiFetch<ApiList<AdminUser>>("/admin/users?limit=80"),
      apiFetch<ApiList<BackendProduct>>("/admin/products/pending?limit=50"),
      apiFetch<ApiList<Plan> | ApiEnvelope<Plan[]>>("/admin/plans"),
      apiFetch<ApiList<ActivityLog>>("/admin/activity-logs?limit=40"),
      apiFetch<ApiList<AppNotification>>("/admin/notifications/mine?limit=50"),
    ]);

    if (dashboardRes.status === "fulfilled") setStats(dashboardRes.value.data ?? {});
    if (usersRes.status === "fulfilled") setUsers(usersRes.value.data ?? []);
    if (pendingRes.status === "fulfilled") setPendingProducts((pendingRes.value.data ?? []).map(normalizeProduct));
    if (plansRes.status === "fulfilled") {
      const value = plansRes.value;
      setPlans("pagination" in value ? value.data : value.data ?? []);
    }
    if (logsRes.status === "fulfilled") setLogs(logsRes.value.data ?? []);
    if (notifRes.status === "fulfilled") setAdminNotifications(notifRes.value.data ?? []);

    setIsRefreshing(false);
  }

  async function loadAdminGif(category?: string, refresh = false) {
    setIsGifLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (refresh) params.set("refresh", "1");
      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/admin-gif${query}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) return;
      const payload = (await response.json()) as AdminGifPayload;
      setAdminGif(payload);
    } catch {
      setAdminGif({
        gifUrl: null,
        title: "Admin companion",
        category: "happy",
        source: "fallback",
      });
    } finally {
      setIsGifLoading(false);
    }
  }

  async function updateRole(target: User, role: Role) {
    await withBusy(`role-${target.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<User>>(`/admin/users/${target.id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        });
        showToast(`Đã cập nhật role ${target.email}.`, "success");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể cập nhật role.");
      }
    });
  }

  async function suspendUser(target: User, isActive: boolean) {
    await withBusy(`suspend-${target.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<User>>(`/admin/users/${target.id}/suspend`, {
          method: "PATCH",
          body: JSON.stringify({ isActive }),
        });
        showToast("Đã cập nhật trạng thái user.", "success");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể cập nhật user.");
      }
    });
  }

  async function updateUserDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      bio: String(form.get("bio") || ""),
      address: String(form.get("address") || ""),
      role: String(form.get("role") || editingUser.role) as Role,
      isActive: form.get("isActive") === "on",
    };

    await withBusy(`edit-user-${editingUser.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<AdminUser>>(`/admin/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Đã cập nhật user.", "success");
        setEditingUser(null);
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể cập nhật user.");
      }
    });
  }

  async function deleteUser(target: AdminUser) {
    if (!window.confirm(`Xóa user ${target.email}? Thao tác này sẽ xóa dữ liệu liên quan và không thể hoàn tác.`)) {
      return;
    }

    await withBusy(`delete-user-${target.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<null>>(`/admin/users/${target.id}`, { method: "DELETE" });
        showToast("Đã xóa user.", "success");
        if (editingUser?.id === target.id) setEditingUser(null);
        if (grantingUser?.id === target.id) setGrantingUser(null);
        if (depositUser?.id === target.id) setDepositUser(null);
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể xóa user.");
      }
    });
  }

  async function grantSellerPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grantingUser) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      planId: Number(form.get("planId") || 0),
      durationDays: Number(form.get("durationDays") || 0) || undefined,
    };

    await withBusy(`grant-plan-${grantingUser.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<unknown>>(`/admin/users/${grantingUser.id}/subscription`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Đã cấp gói seller.", "success");
        setGrantingUser(null);
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể cấp gói seller.");
      }
    });
  }

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!depositUser) return;

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    const description = String(form.get("description") || "").trim();

    if (amount <= 0) {
      showToast("Vui lòng nhập số tiền hợp lệ.", "error");
      return;
    }
    if (amount > 100000000) {
      showToast("Số tiền nạp tối đa là 100,000,000 VND.", "error");
      return;
    }

    await withBusy(`deposit-${depositUser.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<{ transactionId: number; amount: number; newBalance: number }>>(
          `/admin/users/${depositUser.id}/deposit`,
          { method: "POST", body: JSON.stringify({ amount, description }) },
        );
        showToast(`Đã cộng ${amount.toLocaleString("vi-VN")} VND.`, "success");
        setDepositUser(null);
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể nạp tiền.");
      }
    });
  }

  async function moderateProduct(product: StoreProduct, action: "approve" | "reject") {
    await withBusy(`${action}-${product.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<BackendProduct>>(`/admin/products/${product.id}/${action}`, {
          method: "PATCH",
          body: action === "reject" ? JSON.stringify({ reason: "Không đạt tiêu chuẩn marketplace" }) : undefined,
        });
        showToast(action === "approve" ? "Đã duyệt sản phẩm." : "Đã từ chối sản phẩm.", "success");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể xử lý sản phẩm.");
      }
    });
  }

  async function approveAllProducts() {
    await withBusy("approve-all", async () => {
      try {
        const res = await apiFetch<ApiEnvelope<{ count: number }>>("/admin/products/approve-all", { method: "POST" });
        showToast(`Đã duyệt ${res.data?.count ?? 0} sản phẩm.`, "success");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể duyệt tất cả sản phẩm.");
      }
    });
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") || ""),
      price: Number(form.get("price") || 0),
      durationDays: Number(form.get("duration") || 30),
      features: String(form.get("features") || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    await withBusy("create-plan", async () => {
      try {
        await apiFetch<ApiEnvelope<Plan>>("/admin/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Đã tạo plan.", "success");
        formEl.reset();
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể tạo plan.");
      }
    });
  }

  async function deletePlan(plan: Plan) {
    await withBusy(`delete-plan-${plan.id}`, async () => {
      try {
        await apiFetch<ApiEnvelope<null>>(`/admin/plans/${plan.id}`, { method: "DELETE" });
        showToast("Đã xóa plan.", "success");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể xóa plan.");
      }
    });
  }

  async function sendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload: Record<string, unknown> = {
      title: String(form.get("title") || ""),
      content: String(form.get("content") || ""),
    };
    if (broadcastRole !== "ALL") payload.role = broadcastRole;

    await withBusy("broadcast", async () => {
      try {
        await apiFetch<ApiEnvelope<{ sentCount: number }>>("/admin/notifications/broadcast", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Đã gửi thông báo.", "success");
        formEl.reset();
        setBroadcastRole("ALL");
        await loadAdminData();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể gửi thông báo.");
      }
    });
  }

  async function markNotifRead(notifId: number) {
    await withBusy(`read-notif-${notifId}`, async () => {
      try {
        await apiFetch(`/users/me/notifications/${notifId}/read`, { method: "PATCH" });
        setAdminNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)),
        );
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc.");
      }
    });
  }

  async function markAllNotifsRead() {
    try {
      await apiFetch("/users/me/notifications/read-all", { method: "PATCH" });
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast("Đã đánh dấu tất cả đã đọc.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc.");
    }
  }

  async function saveNotifEdit(notifId: number) {
    if (!editTitle.trim() || !editContent.trim()) return;
    await withBusy(`save-notif-${notifId}`, async () => {
      try {
        const res = await apiFetch<ApiEnvelope<AppNotification>>(`/admin/notifications/${notifId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
        });
        if (res?.data) {
          setAdminNotifications((prev) =>
            prev.map((x) => (x.id === notifId ? { ...x, title: res.data.title, content: res.data.content } : x)),
          );
        }
        setEditingNotifId(null);
        showToast("Đã cập nhật thông báo.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể cập nhật thông báo.");
      }
    });
  }

  function startEditNotif(n: AppNotification) {
    setEditingNotifId(n.id);
    setEditTitle(n.title);
    setEditContent(n.content);
  }

  function cancelEditNotif() {
    setEditingNotifId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function deleteNotif(notifId: number) {
    await withBusy(`delete-notif-${notifId}`, async () => {
      try {
        await apiFetch(`/admin/notifications/${notifId}`, { method: "DELETE" });
        setAdminNotifications((prev) => prev.filter((n) => n.id !== notifId));
        showToast("Đã xóa thông báo.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Không thể xóa thông báo.");
      }
    });
  }

  const filteredNotifications = useMemo(() => {
    if (notifFilter === "UNREAD") return adminNotifications.filter((n) => !n.isRead);
    return adminNotifications;
  }, [adminNotifications, notifFilter]);

  const unreadNotifCount = useMemo(
    () => adminNotifications.filter((n) => !n.isRead).length,
    [adminNotifications],
  );

  const statUsers = numberValue(stats.users);
  const statProducts = numberValue(stats.products);
  const statOrders = numberValue(stats.orders);
  const statPending = numberValue(stats.pendingProducts);
  const statRevenue = numberValue(stats.revenue);
  const recentOrders = useMemo(() => (Array.isArray(stats.recentOrders) ? stats.recentOrders : []), [stats.recentOrders]);
  const recentActivities = useMemo(() => logs.slice(0, 10), [logs]);
  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    return users.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.email.toLowerCase().includes(keyword);
      const matchesRole = userRoleFilter === "ALL" || item.role === userRoleFilter;
      const matchesStatus =
        userStatusFilter === "ALL" ||
        (userStatusFilter === "ACTIVE" && item.isActive !== false) ||
        (userStatusFilter === "LOCKED" && item.isActive === false);
      return matchesKeyword && matchesRole && matchesStatus;
    });
  }, [userRoleFilter, userSearch, userStatusFilter, users]);
  const activeUsers = users.filter((item) => item.isActive !== false).length;
  const inactiveUsers = users.filter((item) => item.isActive === false).length;
  const sellerUsers = users.filter((item) => item.role === "SELLER").length;
  const verifiedUsers = users.filter((item) => item.isEmailVerified).length;
  const usersWithPlan = users.filter((item) => item.subscription?.[0]?.plan).length;

  if (isInitializing) {
    return <main className="admin-page px-inline py-block"><div className="skeleton-panel" /></main>;
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <main className="admin-page">
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <ShieldAlert size={34} />
          <h1>Cần quyền admin</h1>
          <p>Đăng nhập bằng tài khoản ADMIN để truy cập console quản trị.</p>
          <Link href="/login?next=/admin" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page admin-redesign px-inline py-block">
      <section className="admin-hero">
        <div className="admin-hero__copy">
          <button type="button" onClick={() => router.back()} className="admin-back-button">
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <span className="admin-kicker">
            <span className="live-dot" />
            Admin console online
          </span>
          <h1>Điều hành marketplace trong một màn hình gọn hơn.</h1>
          <p>Giám sát doanh thu, duyệt sản phẩm, quản lý user, gói seller và thông báo hệ thống với bố cục tập trung hơn.</p>
          <div className="admin-hero__actions">
            <button
              type="button"
              className="admin-primary-action"
              onClick={loadAdminData}
              disabled={isRefreshing}
            >
              <RefreshCcw size={16} className={isRefreshing ? "spin-icon" : ""} />
              {isRefreshing ? "Đang làm mới..." : "Làm mới dữ liệu"}
            </button>
            <button
              type="button"
              className="admin-ghost-action"
              onClick={() => loadAdminGif(undefined, true)}
              disabled={isGifLoading}
            >
              <Sparkles size={16} className={isGifLoading ? "spin-icon" : ""} />
              Đổi GIF
            </button>
          </div>
        </div>

        <aside className="admin-gif-card" aria-label="Admin GIF từ nekos.best">
          <div className="admin-gif-card__visual">
            <div className="admin-gif-card__chrome">
              <span className="admin-gif-card__pill">
                {adminGif?.source === "nekos.best" ? "nekos.best live" : "fallback visual"}
              </span>
              <span className="admin-gif-card__category">{adminGif?.category ?? "random"}</span>
            </div>
            {adminGif?.gifUrl ? (
              <img
                src={adminGif.gifUrl}
                alt={adminGif.title}
                width={adminGif.width ?? 498}
                height={adminGif.height ?? 280}
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="admin-gif-card__fallback">
                <Sparkles size={34} />
              </div>
            )}
          </div>
          <div className="admin-gif-card__meta">
            <span>Admin companion</span>
            <strong>{adminGif?.title ?? "Đang tải GIF..."}</strong>
            <small>
              {adminGif?.source === "nekos.best" ? "GIF ngẫu nhiên từ nekos.best" : "Ảnh fallback tạm thời"} ·{" "}
              {adminGif?.width && adminGif?.height ? `${adminGif.width}×${adminGif.height}` : "adaptive frame"}
            </small>
          </div>
        </aside>
      </section>

      <section className="admin-metrics-grid mt-6">
        <MetricCard icon={<UsersRound size={18} />} label="Người dùng" value={statUsers} tone="blue" />
        <MetricCard icon={<PackageCheck size={18} />} label="Sản phẩm" value={statProducts} tone="violet" />
        <MetricCard icon={<BadgeCheck size={18} />} label="Đơn PAID" value={statOrders} tone="green" />
        <MetricCard icon={<ShieldCheck size={18} />} label="Đang chờ duyệt" value={statPending} tone="amber" />
        <MetricCard icon={<TrendingUp size={18} />} label="Doanh thu" value={formatCurrency(statRevenue)} tone="cyan" />
      </section>

      <div className="dashboard-tabs admin-tabs mt-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "is-active text-on-accent bg-tertiary border-tertiary" : ""}
            onClick={() => setActiveTab(tab)}
          >
            <span>{tabLabels[tab]}</span>
            {tab === "users" ? <small>{users.length}</small> : null}
            {tab === "pending" ? <small>{pendingProducts.length}</small> : null}
            {tab === "notifications" ? <small>{unreadNotifCount}</small> : null}
          </button>
        ))}
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-bold text-primary transition-all hover:border-tertiary/40 hover:bg-tertiary/5 ml-auto"
        >
          <Headphones size={14} />
          Hỗ trợ khách hàng
        </Link>
      </div>

      {activeTab === "overview" ? (
        <section className="dashboard-grid mt-0">
          <AdminCard icon={<Activity size={20} />} title="Đơn hàng gần đây" subtitle="10 đơn mới nhất để theo dõi nhịp xử lý hệ thống.">
            {recentOrders.length ? (
              <div className="w-full overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Trạng thái</th>
                      <th>Tổng tiền</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{order.user?.email ?? order.user?.name ?? "Không rõ"}</td>
                        <td>
                          <StatusPill
                            label={statusLabel(order.status)}
                            tone={order.status === "PAID" ? "success" : "muted"}
                            className="status-pill--orders"
                          />
                        </td>
                        <td>{formatCurrency(order.totalAmount)}</td>
                        <td>{dateLabel(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text="Chưa có dữ liệu đơn hàng gần đây." />
            )}
          </AdminCard>

          <AdminCard icon={<Sparkles size={20} />} title="Lịch sử thao tác" subtitle="Toàn bộ thao tác của admin và seller trên hệ thống theo thời gian gần nhất.">
            <div className="grid gap-3.5">
              {recentActivities.length ? (
                recentActivities.map((entry) => {
                  const role = entry.user?.role === "ADMIN" ? "Admin" : entry.user?.role === "SELLER" ? "Seller" : "Không rõ";
                  const roleTone = entry.user?.role === "ADMIN" ? "info" : "success";
                  return (
                  <article key={`activity-${entry.id}`} className="rounded-lg border border-border bg-neutral p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{entry.action ?? "Hành động"}</strong>
                      <StatusPill label={role} tone={roleTone} />
                    </div>
                    <small className="mt-1 block text-xs font-bold text-secondary">{entry.user?.email ?? "Không rõ tài khoản"}</small>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-bold text-primary">
                      <span>{entry.metadata?.method ?? "--"}</span>
                      <span className="text-secondary">{entry.entity ?? "hệ thống"}</span>
                      <span className="text-secondary">HTTP {entry.metadata?.statusCode ?? "--"}</span>
                    </div>
                    <small className="mt-1 block text-xs font-bold text-secondary">{dateLabel(entry.createdAt)}</small>
                  </article>
                );
                })
              ) : (
                <EmptyState text="Chưa có lịch sử thao tác." />
              )}
            </div>
          </AdminCard>
        </section>
      ) : null}

      {activeTab === "users" ? (
        <section className="admin-users-layout mt-0">
          <AdminCard icon={<UsersRound size={20} />} title="Quản trị người dùng" subtitle="Theo dõi tài khoản, quyền truy cập và trạng thái seller.">
            <div className="admin-users-toolbar">
              <div className="admin-users-stat">
                <strong>{users.length}</strong>
                <span>Tổng tài khoản</span>
              </div>
              <div className="admin-users-stat">
                <strong>{activeUsers}</strong>
                <span>Đang hoạt động</span>
              </div>
              <div className="admin-users-stat">
                <strong>{inactiveUsers}</strong>
                <span>Đang bị khóa</span>
              </div>
              <div className="admin-users-stat">
                <strong>{sellerUsers}</strong>
                <span>Seller</span>
              </div>
              <div className="admin-users-stat">
                <strong>{usersWithPlan}</strong>
                <span>Có gói seller</span>
              </div>
            </div>

            <div className="admin-users-filters">
              <label className="admin-search-field">
                <Search size={16} />
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Tìm theo tên hoặc email..." />
              </label>
              <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as Role | "ALL")}>
                <option value="ALL">Tất cả vai trò</option>
                <option value="USER">Người dùng</option>
                <option value="SELLER">Seller</option>
                <option value="ADMIN">Admin</option>
              </select>
              <select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value as "ALL" | "ACTIVE" | "LOCKED")}>
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="LOCKED">Đang bị khóa</option>
              </select>
            </div>
            <p className="admin-users-result">
              Hiển thị <strong>{filteredUsers.length}</strong> / {users.length} người dùng
            </p>

            <div className="admin-user-list">
              {filteredUsers.length ? (
                filteredUsers.map((item) => {
                  const isRoleBusy = Boolean(busyMap[`role-${item.id}`]);
                  const isSuspendBusy = Boolean(busyMap[`suspend-${item.id}`]);
                  const isDeleting = Boolean(busyMap[`delete-user-${item.id}`]);
                  const currentPlan = item.subscription?.[0]?.plan;
                  const isLocked = item.isActive === false;
                  return (
                    <article key={item.id} className="admin-user-card">
                      <AdminAvatar name={item.name || item.email} avatar={item.avatar} />

                      <div className="admin-user-card__body">
                        <div className="admin-user-card__head">
                          <div className="admin-user-card__identity">
                            <strong>{item.name}</strong>
                            <small>{item.email}</small>
                          </div>
                          <div className="admin-user-card__badges">
                            <StatusPill label={isLocked ? "Đã khóa" : "Hoạt động"} tone={isLocked ? "danger" : "success"} />
                            <StatusPill label={roleLabel(item.role)} tone="info" />
                            <StatusPill label={item.isEmailVerified ? "Email xác minh" : "Chưa xác minh"} tone={item.isEmailVerified ? "success" : "muted"} />
                          </div>
                        </div>

                        <div className="admin-user-card__meta">
                          <span>{item._count?.products ?? 0} sản phẩm</span>
                          <span>{item._count?.orders ?? 0} đơn</span>
                          <span>Tạo: {dateLabel(item.createdAt)}</span>
                        </div>

                        <div className="admin-user-card__controls">
                          <select
                            value={item.role}
                            onChange={(event) => updateRole(item, event.target.value as Role)}
                            disabled={isRoleBusy || isSuspendBusy || isDeleting}
                          >
                            <option value="USER">Người dùng</option>
                            <option value="SELLER">Seller</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <span className="admin-user-card__plan">
                            {currentPlan ? `${currentPlan.name} · hết hạn ${dateLabel(item.subscription?.[0]?.endDate)}` : "Chưa có gói seller"}
                          </span>
                        </div>

                        <div className="admin-user-actions">
                          <button type="button" onClick={() => setEditingUser(item)} disabled={isDeleting}>
                            <Edit3 size={15} />
                            Sửa
                          </button>
                          <button type="button" onClick={() => setGrantingUser(item)} disabled={isDeleting || plans.length === 0}>
                            <Crown size={15} />
                            Cấp gói
                          </button>
                          <button type="button" onClick={() => setDepositUser(item)} disabled={isDeleting}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                            Nạp tiền
                          </button>
                          <button
                            type="button"
                            onClick={() => suspendUser(item, item.isActive === false)}
                            disabled={isRoleBusy || isSuspendBusy || isDeleting}
                          >
                            {item.isActive === false ? <LockOpen size={15} /> : <Lock size={15} />}
                            {isSuspendBusy ? "Đang xử lý..." : item.isActive === false ? "Mở khóa" : "Khóa"}
                          </button>
                          <button type="button" className="is-danger" onClick={() => deleteUser(item)} disabled={isDeleting || item.id === user?.id}>
                            <Trash2 size={15} />
                            {isDeleting ? "Đang xóa..." : "Xóa"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState text="Không tìm thấy user phù hợp." />
              )}
            </div>
          </AdminCard>

          <div className="admin-users-side">
            {editingUser ? (
              <form className="admin-user-form admin-user-form--accent" onSubmit={updateUserDetails}>
                <div>
                  <h2>Sửa user</h2>
                  <p>{editingUser.email}</p>
                </div>
                <label>
                  Tên
                  <input name="name" defaultValue={editingUser.name} required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" defaultValue={editingUser.email} required />
                </label>
                <label>
                  Số điện thoại
                  <input name="phone" defaultValue={editingUser.phone ?? ""} />
                </label>
                <label>
                  Bio
                  <textarea name="bio" rows={3} defaultValue={editingUser.bio ?? ""} />
                </label>
                <label>
                  Địa chỉ
                  <input name="address" defaultValue={editingUser.address ?? ""} />
                </label>
                <label>
                  Vai trò
                  <select name="role" defaultValue={editingUser.role}>
                    <option value="USER">Người dùng</option>
                    <option value="SELLER">Seller</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <label className="admin-check">
                  <input name="isActive" type="checkbox" defaultChecked={editingUser.isActive !== false} />
                  User đang hoạt động
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="submit" disabled={Boolean(busyMap[`edit-user-${editingUser.id}`])} className="inline-flex min-h-[36px] items-center justify-center rounded-[13px] border border-tertiary bg-tertiary px-3.5 text-[13px] font-extrabold text-on-accent disabled:opacity-55">
                    {busyMap[`edit-user-${editingUser.id}`] ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                  <button type="button" onClick={() => setEditingUser(null)} className="inline-flex min-h-[36px] items-center justify-center rounded-[13px] border border-border bg-surface px-3.5 text-[13px] font-extrabold text-primary">
                    Hủy
                  </button>
                </div>
              </form>
            ) : null}

            {grantingUser ? (
              <form className="admin-user-form admin-user-form--seller seller-grant-form" onSubmit={grantSellerPlan}>
                <div>
                  <h2>Cấp gói seller</h2>
                  <p>{grantingUser.email}</p>
                </div>
                <label>
                  Chọn gói
                  <select name="planId" required defaultValue={plans[0]?.id ?? ""}>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} · {formatCurrency(plan.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Thời hạn tùy chỉnh (ngày)
                  <input name="durationDays" type="number" min={1} placeholder="Để trống dùng thời hạn của gói" />
                </label>
                <div className="seller-plan-actions">
                  <button
                    type="submit"
                    disabled={Boolean(busyMap[`grant-plan-${grantingUser.id}`]) || plans.length === 0}
                    className="seller-plan-btn seller-plan-btn--primary"
                  >
                    {busyMap[`grant-plan-${grantingUser.id}`] ? "Đang cấp..." : "Cấp gói"}
                  </button>
                  <button type="button" onClick={() => setGrantingUser(null)} className="seller-plan-btn seller-plan-btn--ghost">
                    Hủy
                  </button>
                </div>
              </form>
            ) : null}

            {depositUser ? (
              <form className="admin-user-form admin-user-form--deposit" onSubmit={handleDeposit}>
                <div>
                  <h2>Nạp tiền vào ví</h2>
                  <p>{depositUser.name} &middot; {depositUser.email}</p>
                </div>

                <label>
                  Số tiền (VND)
                  <input
                    name="amount"
                    type="number"
                    min={10000}
                    max={100000000}
                    step={10000}
                    required
                    placeholder="Nhập số tiền"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5" style={{ marginTop: "-4px", marginBottom: "8px" }}>
                  {[50000, 100000, 200000, 500000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-neutral text-[12px] font-extrabold text-secondary hover:border-tertiary/40 hover:text-primary transition-all"
                      onClick={() => {
                        const input = document.querySelector<HTMLInputElement>('input[name="amount"]');
                        if (input) input.value = String(preset);
                      }}
                    >
                      {formatCurrency(preset)}
                    </button>
                  ))}
                </div>

                <label>
                  Lý do (không bắt buộc)
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Ví dụ: Hoàn tiền đơn #123, Thưởng CTV..."
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2 mt-4">
                  <button
                    type="submit"
                    disabled={Boolean(busyMap[`deposit-${depositUser.id}`])}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[13px] border border-emerald-600 bg-emerald-600 px-3.5 text-[13px] font-extrabold text-white shadow-soft hover:-translate-y-[1px] hover:shadow-hover disabled:opacity-55 disabled:hover:translate-y-0 transition-all"
                  >
                    {busyMap[`deposit-${depositUser.id}`] ? "Đang xử lý..." : "Cộng tiền"}
                  </button>
                  <button type="button" onClick={() => setDepositUser(null)} className="inline-flex min-h-[38px] items-center justify-center rounded-[13px] border border-border bg-surface px-3.5 text-[13px] font-extrabold text-primary">
                    Hủy
                  </button>
                </div>
              </form>
            ) : !editingUser && !grantingUser ? (
              <div className="admin-user-form admin-user-form--idle">
                <div>
                  <h2>Thông tin nhanh</h2>
                  <p>Dữ liệu tài khoản hiện tại</p>
                </div>
                <div className="admin-quick-grid">
                  <article>
                    <strong>{verifiedUsers}</strong>
                    <span>Email đã xác minh</span>
                  </article>
                  <article>
                    <strong>{inactiveUsers}</strong>
                    <span>Tài khoản bị khóa</span>
                  </article>
                  <article>
                    <strong>{sellerUsers}</strong>
                    <span>Seller</span>
                  </article>
                  <article>
                    <strong>{usersWithPlan}</strong>
                    <span>Đang có gói</span>
                  </article>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "pending" ? (
        <AdminCard icon={<PackageCheck size={20} />} title="Kiểm duyệt sản phẩm" subtitle="Duyệt nhanh sản phẩm trước khi lên storefront.">
          {pendingProducts.length ? (
            <>
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  className="admin-approve-button"
                  disabled={Boolean(busyMap["approve-all"])}
                  onClick={approveAllProducts}
                >
                  {busyMap["approve-all"] ? "Đang duyệt..." : `Duyệt tất cả (${pendingProducts.length})`}
                </button>
              </div>
              <div className="w-full overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>Seller</th>
                    <th>Loại</th>
                    <th>Giá</th>
                    <th>Tồn</th>
                    <th className="text-right">Kiểm duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProducts.map((product) => {
                    const approveBusy = Boolean(busyMap[`approve-${product.id}`]);
                    const rejectBusy = Boolean(busyMap[`reject-${product.id}`]);
                    const isBusy = approveBusy || rejectBusy;

                    return (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.sellerName ?? product.sellerId ?? "Không rõ"}</td>
                        <td>{product.type}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="admin-approve-button"
                              disabled={isBusy}
                              onClick={() => moderateProduct(product, "approve")}
                            >
                              {approveBusy ? "Đang duyệt..." : "Duyệt"}
                            </button>
                            <button
                              type="button"
                              className="admin-reject-button"
                              disabled={isBusy}
                              onClick={() => moderateProduct(product, "reject")}
                            >
                              {rejectBusy ? "Đang từ chối..." : "Từ chối"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
            <EmptyState text="Không có sản phẩm nào đang chờ duyệt." />
          )}
        </AdminCard>
      ) : null}

      {activeTab === "plans" ? (
        <section className="dashboard-grid dashboard-grid--editor mt-0">
          <form className="seller-plan-editor" onSubmit={createPlan}>
            <div className="seller-plan-editor__head">
              <BadgeCheck size={20} />
              <div>
                <h2>Tạo gói seller</h2>
                <p>Thiết lập mức giá, thời hạn và quyền lợi của gói.</p>
              </div>
            </div>
            <label>
              Tên gói
              <input name="name" required placeholder="Starter / Growth / Pro" />
            </label>
            <div className="seller-plan-editor__row">
              <label>
                Giá (VND)
                <input name="price" type="number" min={0} required />
              </label>
              <label>
                Thời hạn (ngày)
                <input name="duration" type="number" min={1} defaultValue={30} required />
              </label>
            </div>
            <label>
              Tính năng (mỗi dòng một mục)
              <textarea name="features" rows={5} placeholder="Ví dụ:\nƯu tiên kiểm duyệt\nBáo cáo nâng cao\nHỗ trợ realtime" />
            </label>
            <div className="seller-plan-actions">
              <button type="submit" disabled={Boolean(busyMap["create-plan"])} className="seller-plan-btn seller-plan-btn--primary">
                {busyMap["create-plan"] ? "Đang tạo..." : "Tạo gói"}
              </button>
              <button type="reset" className="seller-plan-btn seller-plan-btn--ghost">
                Xóa form
              </button>
            </div>
          </form>

          <AdminCard icon={<BadgeCheck size={20} />} title="Danh sách gói" subtitle="Theo dõi nhanh trạng thái và giá bán.">
            <div className="grid gap-3.5">
              {plans.length ? (
                plans.map((plan) => {
                  const features = Array.isArray(plan.features) ? plan.features : [];
                  const isDeleting = Boolean(busyMap[`delete-plan-${plan.id}`]);
                  return (
                    <article key={plan.id} className="rounded-lg border border-border bg-neutral p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <strong>{plan.name}</strong>
                        <StatusPill label={plan.isActive === false ? "Tạm dừng" : "Đang bật"} tone={plan.isActive === false ? "muted" : "success"} />
                      </div>
                      <p className="m-0 mt-1 text-sm font-bold text-primary">{formatCurrency(plan.price)} / {plan.durationDays ?? plan.duration ?? 30} ngày</p>
                      {features.length ? (
                        <ul className="m-0 mt-2 grid gap-1 pl-4 text-sm text-secondary">
                          {features.map((feature, index) => (
                            <li key={`${plan.id}-${index}`}>{String(feature)}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => deletePlan(plan)}
                          disabled={isDeleting}
                          className="seller-plan-btn seller-plan-btn--danger seller-plan-btn--compact"
                        >
                          {isDeleting ? "Đang xóa..." : "Xóa gói"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState text="Chưa có gói seller nào." />
              )}
            </div>
          </AdminCard>
        </section>
      ) : null}

      {activeTab === "logs" ? (
        <AdminCard icon={<Activity size={20} />} title="Nhật ký hoạt động" subtitle="Audit trail gần nhất cho các thao tác hệ thống.">
          <div className="grid gap-2.5">
            {logs.length ? (
              logs.map((log) => (
                <article key={log.id} className="rounded-lg border border-border bg-neutral p-3.5">
                  <strong>{log.action ?? "Hoạt động"}</strong>
                  <p className="m-0 mt-1 text-sm text-secondary">
                    {log.entity ?? "hệ thống"} · {log.user?.email ?? "hệ thống"}
                  </p>
                  <small className="mt-1 block text-xs font-bold text-secondary">{dateLabel(log.createdAt)}</small>
                </article>
              ))
            ) : (
              <EmptyState text="Chưa có log hoạt động." />
            )}
          </div>
        </AdminCard>
      ) : null}

      {activeTab === "notifications" ? (
        <section className="dashboard-grid dashboard-grid--editor mt-0">
          <form className="seller-plan-editor" onSubmit={sendBroadcast}>
            <div className="seller-plan-editor__head">
              <Bell size={20} />
              <div>
                <h2>Gửi thông báo hệ thống</h2>
                <p>Soạn thông báo gửi đến toàn bộ người dùng hoặc một nhóm cụ thể.</p>
              </div>
            </div>
            <label>
              Tiêu đề
              <input name="title" required placeholder="Ví dụ: Sự kiện mới, chương trình khuyến mãi..." />
            </label>
            <label>
              Nội dung
              <textarea name="content" rows={4} required placeholder="Nhập nội dung thông báo..." />
            </label>
            <div className="seller-plan-editor__row">
              <label>
                Gửi đến
                <select value={broadcastRole} onChange={(e) => setBroadcastRole(e.target.value as typeof broadcastRole)}>
                  <option value="ALL">Tất cả người dùng</option>
                  <option value="USER">Người dùng (USER)</option>
                  <option value="SELLER">Seller</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
            </div>
            <div className="seller-plan-actions">
              <button
                type="submit"
                disabled={Boolean(busyMap["broadcast"])}
                className="seller-plan-btn seller-plan-btn--primary"
              >
                {busyMap["broadcast"] ? "Đang gửi..." : "Gửi thông báo"}
              </button>
              <button type="reset" className="seller-plan-btn seller-plan-btn--ghost">
                Xóa form
              </button>
            </div>
          </form>

          <AdminCard icon={<Bell size={20} />} title="Thông báo đã nhận" subtitle={`${unreadNotifCount} thông báo chưa đọc`}>
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <select
                value={notifFilter}
                onChange={(e) => setNotifFilter(e.target.value as "ALL" | "UNREAD")}
                className="inline-flex min-h-[36px] items-center rounded-md border border-border bg-surface px-3 text-sm font-extrabold text-primary"
              >
                <option value="ALL">Tất cả thông báo</option>
                <option value="UNREAD">Chưa đọc</option>
              </select>
              <button
                type="button"
                onClick={markAllNotifsRead}
                disabled={unreadNotifCount === 0}
                className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-extrabold text-primary disabled:opacity-50"
              >
                Đánh dấu tất cả đã đọc
              </button>
            </div>
            <div className="grid gap-2.5">
              {filteredNotifications.length ? (
                filteredNotifications.map((notif) => {
                  const isEditing = editingNotifId === notif.id;

                  return (
                  <article
                    key={notif.id}
                    className={`rounded-lg border transition-all duration-200 ${isEditing ? "border-tertiary/40 shadow-soft -translate-y-[1px]" : notif.isRead ? "border-border bg-neutral" : "border-tertiary/25 bg-tertiary/5"}`}
                  >
                    {isEditing ? (
                      <div className="p-4">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Tiêu đề thông báo"
                          className="w-full font-bold text-primary bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-tertiary focus:outline-none focus:ring-1 focus:ring-tertiary/20 transition-colors"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Nội dung thông báo"
                          rows={3}
                          className="w-full mt-2.5 text-sm text-secondary bg-surface border border-border rounded-lg px-3 py-2 resize-y focus:border-tertiary focus:outline-none focus:ring-1 focus:ring-tertiary/20 transition-colors"
                        />
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => saveNotifEdit(notif.id)}
                            disabled={Boolean(busyMap[`save-notif-${notif.id}`]) || !editTitle.trim() || !editContent.trim()}
                            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-tertiary px-3.5 text-xs font-extrabold text-on-accent transition-all hover:-translate-y-[1px] hover:shadow-soft disabled:opacity-50 disabled:hover:translate-y-0"
                          >
                            {busyMap[`save-notif-${notif.id}`] ? "Đang lưu..." : "Lưu thay đổi"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditNotif}
                            className="inline-flex min-h-[32px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-extrabold text-secondary hover:text-primary hover:border-tertiary/30 transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className={notif.isRead ? "text-primary" : "text-tertiary"}>
                                {notif.title}
                              </strong>
                              <StatusPill
                                label={notif.isRead ? "Đã đọc" : "Mới"}
                                tone={notif.isRead ? "muted" : "info"}
                              />
                              {notif.type !== "GENERAL" ? (
                                <StatusPill label={notif.type} tone="info" />
                              ) : null}
                            </div>
                            <p className="m-0 mt-1.5 text-sm text-secondary leading-relaxed line-clamp-3">
                              {notif.content}
                            </p>
                            <small className="mt-2 block text-xs font-bold text-secondary">
                              {dateLabel(notif.createdAt)}
                            </small>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notif.isRead ? (
                              <button
                                type="button"
                                onClick={() => markNotifRead(notif.id)}
                                disabled={Boolean(busyMap[`read-notif-${notif.id}`])}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-secondary hover:text-tertiary hover:border-tertiary/30 transition-colors"
                                title="Đánh dấu đã đọc"
                              >
                                <BadgeCheck size={14} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => startEditNotif(notif)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-secondary hover:text-primary hover:border-tertiary/30 transition-colors"
                              title="Sửa"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNotif(notif.id)}
                              disabled={Boolean(busyMap[`delete-notif-${notif.id}`])}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-secondary hover:text-rose-600 hover:border-rose-400/30 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                )})
              ) : (
                <EmptyState text="Chưa có thông báo nào." />
              )}
            </div>
          </AdminCard>
        </section>
      ) : null}
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: "blue" | "violet" | "green" | "amber" | "cyan";
}) {
  const toneClass = {
    blue: "border-sky-400/25 bg-sky-500/8 text-sky-700",
    violet: "border-violet-400/25 bg-violet-500/8 text-violet-700",
    green: "border-emerald-400/25 bg-emerald-500/8 text-emerald-700",
    amber: "border-amber-400/25 bg-amber-500/8 text-amber-700",
    cyan: "border-cyan-400/25 bg-cyan-500/8 text-cyan-700",
  }[tone];

  return (
    <article className="admin-metric-card rounded-xl border border-card-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-[2px] hover:border-tertiary/25">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-secondary uppercase tracking-wide">{label}</span>
        <span className={`inline-grid h-9 w-9 place-items-center rounded-full border ${toneClass}`}>{icon}</span>
      </div>
      <strong className="mt-3 block text-[clamp(24px,2.7vw,30px)] leading-none tracking-tight">{value}</strong>
    </article>
  );
}

function StatusPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: "success" | "danger" | "info" | "muted";
  className?: string;
}) {
  const toneClass = {
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700",
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-700",
    info: "border-sky-400/30 bg-sky-500/10 text-sky-700",
    muted: "border-border bg-neutral text-secondary",
  }[tone];

  return <span className={`admin-status-pill inline-flex min-h-[28px] items-center rounded-full border px-2.5 text-xs font-extrabold ${toneClass} ${className ?? ""}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="admin-empty-state rounded-lg border border-dashed border-border bg-neutral p-4 text-sm font-bold text-secondary">
      {text}
    </div>
  );
}

function AdminCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-card bg-surface border border-card-border rounded-lg shadow-[0_10px_34px_rgba(0,0,0,0.045)] transition-all duration-medium hover:border-tertiary/25 hover:shadow-soft hover:-translate-y-[2px] p-[clamp(20px,2.6vw,28px)] w-full">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-grid h-9 w-9 place-items-center rounded-full border border-border bg-neutral text-primary">{icon}</span>
          <div>
            <h2 className="mb-1">{title}</h2>
            {subtitle ? <p className="m-0 text-sm text-secondary">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
