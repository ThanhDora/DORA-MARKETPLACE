import { PrismaClient, ProductType, ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting product seeding...');

  // 1. Get or create a seller
  const hashedPassword = await bcrypt.hash('password123', 12);
  const seller = await prisma.user.upsert({
    where: { email: 'seller@minimarketplace.com' },
    update: {},
    create: {
      name: 'Test Seller',
      email: 'seller@minimarketplace.com',
      password: hashedPassword,
      role: 'SELLER',
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Seller user:', seller.email);

  // 2. Get categories
  const categories = await prisma.category.findMany();
  if (categories.length === 0) {
    console.log('❌ No categories found. Please run npm run db:seed first.');
    return;
  }

  // 3. Fake products data
  const productsData = [
    {
      name: 'Tài khoản Netflix Premium 1 tháng',
      description: 'Tài khoản Netflix Premium hỗ trợ 4K, xem được trên 4 thiết bị cùng lúc. Bảo hành trọn đời thời gian sử dụng.',
      price: new Decimal(50000),
      type: ProductType.ACCOUNT,
      categorySlug: 'tai-khoan-mxh',
    },
    {
      name: 'Key Windows 11 Pro Bản Quyền',
      description: 'Key kích hoạt Windows 11 Pro vĩnh viễn, hỗ trợ update thoải mái. Key chính hãng từ Microsoft.',
      price: new Decimal(150000),
      type: ProductType.KEY,
      categorySlug: 'license-key',
    },
    {
      name: 'Tài khoản Steam có sẵn CS:GO Prime',
      description: 'Tài khoản Steam đã mua gói Prime cho CS:GO, rank Gold Nova 2. Phù hợp cho anh em muốn leo rank.',
      price: new Decimal(250000),
      type: ProductType.ACCOUNT,
      categorySlug: 'tai-khoan-game',
    },
    {
      name: 'Ebook Lập Trình TypeScript Nâng Cao',
      description: 'Cuốn sách hướng dẫn chi tiết về TypeScript từ cơ bản đến nâng cao. Bao gồm các project thực tế.',
      price: new Decimal(99000),
      type: ProductType.FILE,
      categorySlug: 'ebook',
    },
    {
      name: 'Adobe Creative Cloud 1 Năm',
      description: 'Gói đăng ký Adobe Creative Cloud đầy đủ ứng dụng trong 1 năm. Sử dụng trên email cá nhân.',
      price: new Decimal(1200000),
      type: ProductType.ACCOUNT,
      categorySlug: 'phan-mem',
    },
    {
        name: 'Tài khoản Spotify Premium 1 năm',
        description: 'Tài khoản nghe nhạc Spotify Premium không quảng cáo, chất lượng âm thanh cao nhất.',
        price: new Decimal(180000),
        type: ProductType.ACCOUNT,
        categorySlug: 'tai-khoan-mxh',
      },
  ];

  for (const data of productsData) {
    const category = categories.find(c => c.slug === data.categorySlug);
    const slug = data.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substring(7);

    await prisma.product.create({
      data: {
        name: data.name,
        slug: slug,
        description: data.description,
        price: data.price,
        type: data.type,
        status: ProductStatus.APPROVED,
        isApproved: true,
        approvedAt: new Date(),
        sellerId: seller.id,
        categoryId: category ? category.id : null,
        stock: 100,
        images: ['https://picsum.photos/seed/' + slug + '/600/400'],
      },
    });
  }

  console.log('✅ Created', productsData.length, 'fake products');
  console.log('🎉 Product seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
