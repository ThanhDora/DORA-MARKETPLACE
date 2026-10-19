// Demo product images: SFW anime art from nekos.best (https://nekos.best),
// resized to WebP and self-hosted in Client/public/demo/. Credits: Client/public/demo/CREDITS.md
export const DEMO_IMAGE_BASE = 'https://dora-marketplace.vercel.app/demo/';

export const DEMO_PRODUCT_IMAGES: Record<string, string> = {
  'Tài khoản Netflix Premium 1 tháng': DEMO_IMAGE_BASE + 'anime-1.webp',
  'Key Windows 11 Pro Bản Quyền': DEMO_IMAGE_BASE + 'anime-2.webp',
  'Tài khoản Steam có sẵn CS:GO Prime': DEMO_IMAGE_BASE + 'anime-3.webp',
  'Ebook Lập Trình TypeScript Nâng Cao': DEMO_IMAGE_BASE + 'anime-4.webp',
  'Adobe Creative Cloud 1 Năm': DEMO_IMAGE_BASE + 'anime-5.webp',
  'Tài khoản Spotify Premium 1 năm': DEMO_IMAGE_BASE + 'anime-6.webp',
};

export const DEMO_IMAGE_POOL = Object.values(DEMO_PRODUCT_IMAGES);
