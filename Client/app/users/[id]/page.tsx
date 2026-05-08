import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_BASE_URL, normalizeProduct, type BackendProduct } from "@/lib/api";
import { UserProfileClient } from "@/components/UserProfileClient";

type PublicUser = {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  address?: string | null;
  role: string;
  createdAt: string;
  _count: { products: number; orders: number };
};

type PageProps = { params: Promise<{ id: string }> };

async function fetchUser(id: string): Promise<PublicUser | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 12;

async function fetchProducts(id: string) {
  const empty = { items: [], pagination: { page: 1, limit: PAGE_SIZE, total: 0 } };
  try {
    const res = await fetch(
      `${API_BASE_URL}/users/${id}/products?limit=${PAGE_SIZE}&page=1`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return empty;
    const json = await res.json();
    const raw: BackendProduct[] = Array.isArray(json.data) ? json.data : [];
    return {
      items: raw.map(normalizeProduct),
      pagination: json.pagination ?? { page: 1, limit: PAGE_SIZE, total: raw.length },
    };
  } catch {
    return empty;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await fetchUser(id);
  if (!user) return { title: "Không tìm thấy người dùng" };
  return {
    title: `${user.name} — DORA Marketplace`,
    description: user.bio ?? `Trang cá nhân của ${user.name} trên DORA Marketplace`,
    openGraph: {
      title: user.name,
      description: user.bio ?? undefined,
      images: user.avatar ? [user.avatar] : [],
    },
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { id } = await params;
  const [user, productsResult] = await Promise.all([fetchUser(id), fetchProducts(id)]);

  if (!user) notFound();

  return (
    <main>
      <UserProfileClient
        user={user}
        initialProducts={productsResult.items}
        initialPagination={productsResult.pagination}
      />
    </main>
  );
}
