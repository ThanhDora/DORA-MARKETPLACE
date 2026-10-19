// One-off: replace picsum.photos placeholder images on existing demo products
// with the anime demo images. Only touches products whose images point at
// picsum.photos; every other product is left alone. Safe to re-run.
import { PrismaClient } from '@prisma/client';
import { DEMO_PRODUCT_IMAGES, DEMO_IMAGE_POOL } from './demo-images';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
  const targets = products.filter((p) => JSON.stringify(p.images ?? []).includes('picsum.photos'));
  let i = 0;
  for (const p of targets) {
    const url = DEMO_PRODUCT_IMAGES[p.name] ?? DEMO_IMAGE_POOL[i++ % DEMO_IMAGE_POOL.length];
    await prisma.product.update({ where: { id: p.id }, data: { images: [url] } });
    console.log(`🖼️  #${p.id} ${p.name} -> ${url}`);
  }
  console.log(`✅ Updated ${targets.length} demo product image(s)`);
}

main()
  .catch((e) => {
    console.error('❌ Image update error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
