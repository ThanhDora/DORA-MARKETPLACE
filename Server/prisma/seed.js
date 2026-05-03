import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Starting seed...');
    const adminPassword = await bcrypt.hash('Admin@123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@minimarketplace.com' },
        update: {},
        create: {
            name: 'Admin',
            email: 'admin@minimarketplace.com',
            password: adminPassword,
            role: 'ADMIN',
            isEmailVerified: true,
            isActive: true,
        },
    });
    console.log('✅ Admin user created:', admin.email);
    const plans = [
        {
            name: 'Basic',
            description: 'Gói cơ bản cho người mới bắt đầu',
            price: 99000,
            durationDays: 30,
            maxProducts: 10,
            features: JSON.stringify(['Đăng tối đa 10 sản phẩm', 'Hỗ trợ qua email', 'Báo cáo cơ bản']),
        },
        {
            name: 'Standard',
            description: 'Gói tiêu chuẩn cho người bán thường xuyên',
            price: 199000,
            durationDays: 30,
            maxProducts: 50,
            features: JSON.stringify(['Đăng tối đa 50 sản phẩm', 'Hỗ trợ 24/7', 'Báo cáo chi tiết', 'API access']),
        },
        {
            name: 'Premium',
            description: 'Gói cao cấp cho doanh nghiệp',
            price: 499000,
            durationDays: 30,
            maxProducts: null,
            features: JSON.stringify(['Không giới hạn sản phẩm', 'Hỗ trợ 24/7', 'Báo cáo nâng cao', 'API access', 'Marketing tools']),
        },
    ];
    for (const plan of plans) {
        await prisma.subscriptionPlan.upsert({
            where: { id: plan.name.toLowerCase() },
            update: plan,
            create: { id: plan.name.toLowerCase(), ...plan },
        });
    }
    console.log('✅ Subscription plans created');
    const categories = [
        { name: 'Tài khoản Game', slug: 'tai-khoan-game', icon: 'gamepad' },
        { name: 'Tài khoản MXH', slug: 'tai-khoan-mxh', icon: 'users' },
        { name: 'License Key', slug: 'license-key', icon: 'key' },
        { name: 'Phần mềm', slug: 'phan-mem', icon: 'software' },
        { name: 'Ebook', slug: 'ebook', icon: 'book' },
        { name: 'Khác', slug: 'khac', icon: 'box' },
    ];
    for (const cat of categories) {
        await prisma.category.upsert({
            where: { slug: cat.slug },
            update: cat,
            create: cat,
        });
    }
    console.log('✅ Categories created');
    const prompts = [
        {
            name: 'default',
            content: `Bạn là trợ lý AI của Mini Marketplace - nền tảng thương mại điện tử cho các sản phẩm số.

Hãy hỗ trợ người dùng về:
- Tìm kiếm và mua sản phẩm số (tài khoản, license key, file)
- Thông tin tài khoản và đơn hàng
- Hỗ trợ kỹ thuật liên quan đến sản phẩm
- Các câu hỏi thường gặp (FAQ)
- Tư vấn về subscription và gói dịch vụ

Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. Nếu không biết câu trả lời, hãy nói rõ và hướng dẫn người dùng liên hệ hỗ trợ.`,
            isActive: true,
        },
        {
            name: 'seller',
            content: `Bạn là trợ lý AI chuyên tư vấn cho người bán trên Mini Marketplace.

Hãy hỗ trợ về:
- Cách tạo và quản lý sản phẩm
- Chiến lược định giá
- Tối ưu hóa listing sản phẩm
- Quản lý subscription và payout
- Marketing và khuyến mãi
- Các câu hỏi về chính sách nền tảng

Hãy đưa ra lời khuyên thực tế và có thể áp dụng ngay.`,
            isActive: true,
        },
    ];
    for (const prompt of prompts) {
        await prisma.aIPromptTemplate.upsert({
            where: { name: prompt.name },
            update: prompt,
            create: prompt,
        });
    }
    console.log('✅ AI prompt templates created');
    console.log('🎉 Seed completed successfully!');
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map