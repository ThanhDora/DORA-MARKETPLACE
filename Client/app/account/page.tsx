"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  Heart,
  LogOut,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  ShieldAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  API_BASE_URL,
  formatCurrency,
  normalizeProduct,
  type ApiEnvelope,
  type ApiList,
  type StoreProduct,
  type WalletData,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useRealtime } from "@/components/RealtimeProvider";
import { useToast } from "@/components/ToastProvider";

type WishlistItem = {
  id: number;
  product: Parameters<typeof normalizeProduct>[0];
};

type ProfileData = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  phone?: string | null;
  bio?: string | null;
  address?: string | null;
  isEmailVerified?: boolean;
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function userInitials(name?: string) {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Quản trị viên";
  if (role === "SELLER") return "Người bán";
  return "Người mua";
}

function resolveAvatarUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    if (raw.startsWith("/api/")) return `${apiOrigin}${raw}`;
    if (raw.startsWith("/uploads/")) return `${apiOrigin}/api${raw}`;
  } catch {}

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, apiFetch, logout } = useAuth();
  const { unreadNotificationCount, orderUpdates } = useRealtime();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [wishlist, setWishlist] = useState<StoreProduct[]>([]);
  const [showAllWishlist, setShowAllWishlist] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", bio: "", address: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarBroken, setIsAvatarBroken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const displayName = profile?.name ?? user?.name ?? "";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const displayRole = profile?.role ?? user?.role ?? "";
  const displayAvatar = profile?.avatar ?? user?.avatar ?? null;
  const displayAvatarSrc = resolveAvatarUrl(displayAvatar);
  const notifCount = unreadNotificationCount;
  const visibleWishlist = showAllWishlist ? wishlist : wishlist.slice(0, 10);

  const profileCompleteness = useMemo(() => {
    const fields = [
      displayName?.trim(),
      displayEmail?.trim(),
      profile?.phone?.trim(),
      profile?.address?.trim(),
      profile?.bio?.trim(),
      displayAvatar,
    ];
    const done = fields.filter(Boolean).length;
    return Math.round((done / fields.length) * 100);
  }, [displayAvatar, displayEmail, displayName, profile?.address, profile?.bio, profile?.phone]);

  useEffect(() => {
    setIsAvatarBroken(false);
  }, [displayAvatarSrc]);

  const loadOrderCount = useCallback(async () => {
    if (!isAuthenticated) {
      setOrderCount(0);
      return;
    }
    try {
      const response = await apiFetch<ApiList<{ id: number }>>("/orders?limit=1", { notifySuccess: false });
      setOrderCount(response.pagination?.total ?? response.data.length);
    } catch {
      // Keep previous order count when request fails.
    }
  }, [apiFetch, isAuthenticated]);

  useEffect(() => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      setAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setAvatarPreview(null);
  }, [avatarFile]);

  useEffect(() => {
    if (!isAuthenticated) return;

    apiFetch<ApiEnvelope<ProfileData>>("/users/me", { notifySuccess: false })
      .then((res) => setProfile(res.data))
      .catch(() => {});

    apiFetch<ApiEnvelope<WalletData>>("/wallet", { notifySuccess: false })
      .then((res) => setWalletBalance(res.data.balance))
      .catch(() => {});

    apiFetch<ApiEnvelope<{ items?: WishlistItem[] } | WishlistItem[]>>("/wishlist")
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : response.data.items ?? [];
        setWishlist(data.map((item) => normalizeProduct(item.product)));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Không thể tải tài khoản."));
  }, [apiFetch, isAuthenticated, showToast]);

  useEffect(() => {
    void loadOrderCount();
  }, [loadOrderCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setTimeout(() => {
      void loadOrderCount();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, loadOrderCount, orderUpdates]);

  function openEditor() {
    setEditForm({
      name: displayName,
      phone: profile?.phone ?? "",
      bio: profile?.bio ?? "",
      address: profile?.address ?? "",
    });
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsEditing(true);
  }

  function handlePickAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast("Định dạng ảnh không hỗ trợ (dùng jpeg, png, gif, webp).", "error");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      showToast("Ảnh vượt quá 5MB.", "error");
      return;
    }
    setAvatarFile(file);
    event.target.value = "";
  }

  async function handleSaveProfile() {
    const name = editForm.name.trim();
    if (!name) {
      showToast("Tên là bắt buộc.", "error");
      return;
    }
    setIsSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("images", avatarFile);
        const uploadRes = await apiFetch<ApiEnvelope<{ urls: string[] }>>("/products/upload-images", {
          method: "POST",
          body: formData,
          notifySuccess: false,
        });
        avatarUrl = uploadRes.data?.urls?.[0];
      }

      const body: Record<string, unknown> = { name };
      if (editForm.phone !== undefined) body.phone = editForm.phone.trim();
      if (editForm.bio !== undefined) body.bio = editForm.bio.trim();
      if (editForm.address !== undefined) body.address = editForm.address.trim();
      if (avatarUrl) body.avatar = avatarUrl;

      const res = await apiFetch<ApiEnvelope<ProfileData>>("/users/me", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setProfile(res.data);
      showToast("Đã cập nhật hồ sơ.", "success");
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
    } catch {
      // Bỏ qua lỗi logout nếu session đã hết hạn
    }
  }

  if (isInitializing) {
    return <main className="px-inline py-block"><div className="skeleton-panel" /></main>;
  }

  if (!isAuthenticated) {
    return (
      <main>
        <section className="px-inline py-[clamp(58px,7vw,84px)] grid min-h-[calc(100svh-var(--header-height))] place-items-center content-center text-center">
          <h1>Cần đăng nhập</h1>
          <p>Đăng nhập để xem đơn hàng, yêu thích và thông báo.</p>
          <Link href="/login?next=/account" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary">
            Đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page px-inline py-block">
      <section className="account-dashboard">
        <div className="account-dashboard__main">
          <article className="account-profile-panel">
            <div className="account-profile-panel__top">
              <div className="account-profile-panel__avatar-wrap">
                <div className="account-profile-panel__avatar">
                  {displayAvatarSrc && !isAvatarBroken ? (
                    <img src={displayAvatarSrc} alt={displayName} onError={() => setIsAvatarBroken(true)} />
                  ) : (
                    <span>{userInitials(displayName)}</span>
                  )}
                </div>
              </div>

              <div className="account-profile-panel__identity">
                <h2>{displayName}</h2>
                <p>{displayEmail}</p>
                <span className="account-profile-panel__role">
                  <ShieldAlert size={13} />
                  {roleLabel(displayRole)}
                </span>
              </div>
            </div>

            <div className="account-profile-panel__meta">
              <div className="account-profile-panel__meta-item">
                <Phone size={14} />
                <span>{profile?.phone?.trim() || "Chưa cập nhật số điện thoại"}</span>
              </div>
              <div className="account-profile-panel__meta-item">
                <MapPin size={14} />
                <span>{profile?.address?.trim() || "Chưa cập nhật địa chỉ"}</span>
              </div>
            </div>

            <div className="account-profile-panel__stats">
              <div className="account-profile-panel__stat">
                <small>Đơn hàng</small>
                <strong>{orderCount}</strong>
              </div>
              <div className="account-profile-panel__stat">
                <small>Ví hiện có</small>
                <strong>{walletBalance !== null ? formatCurrency(walletBalance) : "..."}</strong>
              </div>
              <div className="account-profile-panel__stat">
                <small>Thông báo mới</small>
                <strong>{notifCount > 99 ? "99+" : notifCount}</strong>
              </div>
              <div className="account-profile-panel__stat">
                <small>Hoàn thiện hồ sơ</small>
                <strong>{profileCompleteness}%</strong>
              </div>
            </div>

            <div className="account-profile-panel__progress">
              <div className="account-profile-panel__progress-copy">
                <strong>Độ hoàn thiện hồ sơ</strong>
                <span>
                  {profileCompleteness}% sẵn sàng.
                  {profileCompleteness >= 80 ? " Hồ sơ của bạn đã đủ tốt để mua bán mượt hơn." : " Bổ sung thêm thông tin để tài khoản đáng tin cậy hơn."}
                </span>
              </div>
              <div className="account-profile-panel__progress-bar" aria-hidden="true">
                <span style={{ width: `${profileCompleteness}%` }} />
              </div>
            </div>

            <div className="account-profile-panel__bio">
              <small>Giới thiệu</small>
              <p>{profile?.bio?.trim() || "Bạn chưa thêm phần giới thiệu. Một đoạn mô tả ngắn sẽ giúp hồ sơ nhìn đầy đặn và đáng tin cậy hơn."}</p>
            </div>

            {!isEditing ? (
              <div className="account-profile-panel__actions">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[13px] border border-border bg-surface px-5 text-[14px] font-extrabold text-primary transition-all hover:-translate-y-[1px] hover:border-tertiary/30 hover:shadow-soft"
                  onClick={openEditor}
                >
                  <Pencil size={15} />
                  Chỉnh sửa hồ sơ
                </button>
              </div>
            ) : null}
          </article>

          {isEditing ? (
            <article className="account-edit-form">
              <div className="account-edit-form__head">
                <UserRound size={20} />
                <div>
                  <h2>Chỉnh sửa hồ sơ</h2>
                  <p>Cập nhật nhanh thông tin để tăng độ tin cậy tài khoản.</p>
                </div>
              </div>

              <label>
                Tên
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Tên của bạn"
                  required
                />
              </label>

              <div className="account-edit-form__row">
                <label>
                  <span className="inline-flex items-center gap-1.5"><Phone size={13} /> Số điện thoại</span>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0901234567"
                  />
                </label>
                <label>
                  <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> Địa chỉ</span>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="TP. Hồ Chí Minh"
                  />
                </label>
              </div>

              <label>
                Giới thiệu
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Giới thiệu ngắn về bạn..."
                />
              </label>

              <div>
                <p className="text-[13px] font-extrabold text-primary mb-2">Ảnh đại diện</p>
                <label className="account-edit-form__avatar-pick">
                  <Camera size={14} />
                  {avatarFile ? "Đổi ảnh khác" : "Chọn ảnh"}
                  <input type="file" accept="image/*" onChange={handlePickAvatar} />
                </label>
                {avatarPreview ? (
                  <div className="account-edit-form__avatar-preview">
                    <img src={avatarPreview} alt="Avatar preview" />
                  </div>
                ) : displayAvatarSrc ? (
                  <div className="account-edit-form__avatar-preview">
                    <img src={displayAvatarSrc} alt="Current avatar" onError={() => setIsAvatarBroken(true)} />
                  </div>
                ) : null}
              </div>

              <div className="account-edit-form__actions">
                <button
                  type="button"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95 text-on-accent bg-tertiary border border-tertiary disabled:opacity-55 disabled:pointer-events-none"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md px-5 py-3 text-[15px] font-bold text-center border border-border bg-surface text-primary shadow-soft transition-all duration-fast hover:-translate-y-[2px] hover:shadow-hover active:translate-y-0 active:scale-95"
                  onClick={() => {
                    setIsEditing(false);
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  disabled={isSaving}
                >
                  Hủy
                </button>
              </div>
            </article>
          ) : null}

          <article className="account-shortcuts">
            <div className="account-shortcuts__head">
              <h2>Điều hướng nhanh</h2>
              <p>Truy cập nhanh các phần bạn dùng thường xuyên.</p>
            </div>

            <div className="account-shortcuts__grid">
              <Link href="/account/notifications" className="account-shortcuts__tile">
                <div className="account-shortcuts__tile-main">
                  <Bell size={18} />
                  Thông báo
                </div>
                <span className="account-shortcuts__tile-caption">{notifCount > 0 ? `${notifCount > 99 ? "99+" : notifCount} chưa đọc` : "Không có mới"}</span>
              </Link>

              <Link href="/account/orders" className="account-shortcuts__tile">
                <div className="account-shortcuts__tile-main">
                  <PackageCheck size={18} />
                  Đơn hàng của tôi
                </div>
                <span className="account-shortcuts__tile-caption">{orderCount} đơn</span>
              </Link>

              <Link href="/account/wallet" className="account-shortcuts__tile">
                <div className="account-shortcuts__tile-main">
                  <Wallet size={18} />
                  Ví của tôi
                </div>
                <span className="account-shortcuts__tile-caption">{walletBalance !== null ? formatCurrency(walletBalance) : "Đang tải..."}</span>
              </Link>

              {displayRole === "ADMIN" ? (
                <Link href="/admin" className="account-shortcuts__tile">
                  <div className="account-shortcuts__tile-main">
                    <ShieldAlert size={18} />
                    Quản trị Admin
                  </div>
                  <span className="account-shortcuts__tile-caption">Bảng điều khiển hệ thống</span>
                </Link>
              ) : null}

              {displayRole === "SELLER" || displayRole === "ADMIN" ? (
                <Link href="/seller" className="account-shortcuts__tile">
                  <div className="account-shortcuts__tile-main">
                    <ShieldAlert size={18} />
                    Kênh bán hàng
                  </div>
                  <span className="account-shortcuts__tile-caption">Quản lý sản phẩm và đơn bán</span>
                </Link>
              ) : null}
            </div>
          </article>
        </div>

        <aside className="account-dashboard__side">
          <article className="account-focus-card">
            <div className="account-focus-card__head">
              <ShieldAlert size={18} />
              <div>
                <h2>Trạng thái tài khoản</h2>
                <p>Nhìn nhanh các chỉ số quan trọng nhất của hồ sơ hiện tại.</p>
              </div>
            </div>

            <div className="account-focus-card__grid">
              <div className="account-focus-card__item">
                <small>Email</small>
                <strong>{profile?.isEmailVerified ? "Đã xác minh" : "Chưa xác minh"}</strong>
              </div>
              <div className="account-focus-card__item">
                <small>Vai trò</small>
                <strong>{roleLabel(displayRole)}</strong>
              </div>
              <div className="account-focus-card__item">
                <small>Yêu thích</small>
                <strong>{wishlist.length} sản phẩm</strong>
              </div>
              <div className="account-focus-card__item">
                <small>Có số điện thoại</small>
                <strong>{profile?.phone?.trim() ? "Đã thêm" : "Chưa có"}</strong>
              </div>
            </div>

            <button type="button" className="account-logout-btn" onClick={handleLogout}>
              <LogOut size={17} />
              Đăng xuất
            </button>
          </article>

          <article className="account-wishlist-card">
            <div className="account-wishlist-card__head">
              <Heart size={18} />
              <h2>Danh sách yêu thích</h2>
            </div>

            {wishlist.length ? (
              <div className="account-wishlist-card__list">
                {visibleWishlist.map((product) => (
                  <Link key={product.id} href={`/products/${product.id}`} className="account-wishlist-card__item">
                    <span className="account-wishlist-card__visual">
                      {product.images[0] ? <img src={product.images[0]} alt={product.name} /> : <span>{product.type}</span>}
                    </span>
                    <span className="account-wishlist-card__body">
                      <span className="account-wishlist-card__name">{product.name}</span>
                      <span className="account-wishlist-card__type">{product.type}</span>
                    </span>
                    <span className="account-wishlist-card__price">{formatCurrency(product.price)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="account-wishlist-card__empty">Chưa lưu sản phẩm nào.</p>
            )}

            {wishlist.length > 10 ? (
              <button
                type="button"
                className="account-wishlist-card__more"
                onClick={() => setShowAllWishlist((current) => !current)}
              >
                {showAllWishlist ? "Thu gọn" : `Xem thêm ${wishlist.length - 10} sản phẩm`}
              </button>
            ) : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
