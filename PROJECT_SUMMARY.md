# Mini Marketplace Summary

## 1. Tổng quan
Mini Marketplace là một nền tảng thương mại điện tử chuyên cung cấp sản phẩm số, bao gồm tài khoản, key, file số. Nền tảng có đầy đủ các luồng chức năng cho người mua, người bán (seller) và quản trị viên (admin).

Dự án được chia làm 2 phần chính:
- `Client`: Ứng dụng Frontend xây dựng bằng Next.js (App Router), cung cấp giao diện tương tác cho cả người mua, người bán và admin.
- `Server`: Ứng dụng Backend xây dựng bằng Express.js, TypeScript, kết nối với cơ sở dữ liệu PostgreSQL (thông qua Prisma), sử dụng Redis để caching và Socket.IO cho tính năng realtime.

## 2. Stack Công Nghệ Chính
- **Frontend**: Next.js (App Router), React, TypeScript, TailwindCSS, Framer Motion, Lucide-react, Socket.IO client, Zod.
- **Backend**: Node.js 20, Express, TypeScript, Prisma ORM, PostgreSQL, Redis, Socket.IO, Zod validation, JWT, Nodemailer, Google OAuth, Tích hợp thanh toán (MoMo, SePay, PayPal). Docker + Docker Compose.
- **Tài liệu**: File Word API doc (`Mini_Marketplace_API_Doc.docx`), tài liệu static trong `Server/docs`, và Bruno collection API trong thư mục `MINI MARKETPLACE`.

## 3. Kiến Trúc Backend
Backend được tổ chức theo module tại thư mục `Server/src/`:
- **Auth**: Đăng ký, đăng nhập, xác thực qua email, quên/đổi mật khẩu, Google OAuth.
- **Users**: Quản lý hồ sơ, danh sách đơn hàng, thông báo.
- **Products/Categories**: Quản lý sản phẩm, danh mục, gợi ý tìm kiếm, duyệt/từ chối sản phẩm từ admin.
- **Cart/Wishlist/Reviews**: Tính năng giỏ hàng, danh sách yêu thích, đánh giá.
- **Orders/Payments**: Xử lý tạo đơn hàng, quản lý trạng thái, tích hợp thanh toán (MoMo, SePay, PayPal, Bank Transfer) thông qua Webhooks.
- **Subscriptions/Payouts**: Đăng ký gói cho người bán, cấu hình thanh toán, quản lý rút tiền.
- **Chat**: Hệ thống chat realtime và chat AI.
- **Admin**: Bảng điều khiển (dashboard), quản lý user, phê duyệt sản phẩm chờ.

**Các file lõi**:
- `Server/src/app.ts`: Cấu hình ứng dụng Express và Middleware.
- `Server/src/server.ts`: Entry point để khởi động server.
- `Server/prisma/schema.prisma`: Khai báo mô hình dữ liệu (Database Schema).
- `Server/src/lib/jwt.ts`: Xử lý token JWT.
- `Server/src/services/payment.service.ts`: Xử lý tích hợp thanh toán.
- `Server/src/services/ai.service.ts`: Xử lý chat AI.

## 4. Kiến Trúc Frontend
Frontend nằm trong thư mục `Client/`, tập trung vào UI Storefront và Dashboard:
- **Home**: Giới thiệu marketplace và sản phẩm nổi bật.
- **Catalog/Search**: Tìm kiếm sản phẩm, bộ lọc, sắp xếp.
- **Product Detail (`/products/[slug]`)**: Hình ảnh chi tiết, đánh giá, chức năng thêm vào giỏ / mua ngay.
- **Cart & Checkout (`/cart`, `/checkout`)**: Xử lý giỏ hàng và thanh toán. Trang `/cart` đã được định nghĩa tại `Client/app/cart/page.tsx`.
- **Account/Seller/Admin Pages**: Trang quản lý dữ liệu cho từng đối tượng (sử dụng dữ liệu thực từ API).
- **Auth Pages**: Các trang riêng biệt cho Login, Register, Forgot Password, Reset Password.

**Các file lõi**:
- `Client/app/page.tsx`, `Client/app/catalog/page.tsx`, `Client/app/products/[slug]/page.tsx`
- `Client/components/AuthProvider.tsx`, `Client/components/RealtimeProvider.tsx`
- `Client/lib/api.ts`

## 5. Verifications
- **Backend build**: Hoạt động bình thường.
- **Frontend typecheck**: Thất bại với 1 lỗi tại `Client/components/SearchInput.tsx` (Lỗi do gọi `isNumericId(p.id)` với giá trị `number` trong khi hàm yêu cầu `string`).

## 6. Điểm Cần Chú Ý & Các Bug Cần Sửa
1. **Route Conflict ở Products API**: Trong `Server/src/routes/product.routes.ts`, route `router.get('/:id')` được đặt trước `router.get('/seller/my')`. Điều này khiến request của seller bị bắt nhầm vào route `/:id`, dẫn đến lỗi khi truy xuất sản phẩm của người bán.
2. **Thiếu Dữ Liệu Khi Tạo Sản Phẩm**: Trong `Server/src/controllers/product.controller.ts` (hàm `createProduct`), biến `slug` được tạo ra để đảm bảo tính duy nhất nhưng **không được truyền** vào `prisma.product.create()`, dẫn đến sản phẩm không lưu được slug.
3. **Lỗi Runtime vì dùng CommonJS trong ESM**: File `Server/src/app.ts` (ESM module) đang sử dụng cú pháp `require('./lib/jwt.js')` trong middleware xử lý `/api/uploads`. Điều này sẽ gây lỗi runtime "require is not defined".
4. **Trạng Thái Đơn Hàng Không Đồng Nhất**: `payment.service.ts` đổi trạng thái đơn hàng từ `DELIVERING` sang `DELIVERED`, trong khi nhiều logic khác vẫn đang dựa trên trạng thái `PAID`.
5. **Sai Lệch Schema và Migration**: `Server/prisma/schema.prisma` và migration có thể đang không đồng bộ ở kiểu dữ liệu `id` và một số enum.
6. **Lỗi Dockerfile**: `Server/Dockerfile` đang copy `pnpm-lock.yaml` và `pnpm-workspace.yaml`, nhưng thực tế project đang dùng `package-lock.json` và `npm`.
7. **Dữ Liệu Nhạy Cảm Trong Repo**: Bruno collection và `.claude/settings.local.json` chứa token và dữ liệu môi trường, không nên commit nguyên trạng lên public repo.

## 7. Kết Luận
Dự án đã có cấu trúc, giao diện và luồng xử lý khá hoàn chỉnh cho một nền tảng bán sản phẩm số. Tuy nhiên, trước khi có thể deploy thực tế, các lỗi nghiêm trọng về Route Order (ở API Products), thiếu trường `slug` khi lưu Database, và lỗi runtime do `require` trong môi trường ESM cần được xử lý triệt để. Ngoài ra, Frontend cần sửa lỗi kiểu dữ liệu để hoàn thành bước kiểm tra (Typecheck) và Build.
