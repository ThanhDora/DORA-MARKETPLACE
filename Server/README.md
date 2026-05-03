# Mini Marketplace Backend

Node.js + Express + TypeScript + PostgreSQL + Prisma + Redis + Docker

## Công nghệ

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **Real-time**: Socket.io
- **Validation**: Zod
- **Authentication**: JWT + Google OAuth
- **Container**: Docker + Docker Compose

## Cấu trúc thư mục

```
Server/
├── src/
│   ├── config/          # Cấu hình app
│   ├── controllers/     # Logic xử lý request
│   ├── lib/              # Thư viện, kết nối DB, socket
│   ├── middleware/      # Express middleware
│   ├── routes/          # Định nghĩa API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utilities, helpers
│   ├── validations/     # Zod schemas
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Database seeder
├── tests/                # Unit tests
├── docker-compose.yml    # Docker orchestration
├── Dockerfile            # Container image
└── package.json
```

## Scripts

```bash
npm run dev          # Development mode
npm run build        # Build production
npm run start        # Run production
npm run test         # Run tests
npm run lint         # ESLint check
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to DB
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:studio    # Prisma Studio
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/google` - Google OAuth
- `POST /api/auth/verify-email` - Xác minh email
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Đặt lại mật khẩu

### Users
- `GET /api/users/me` - Profile của tôi
- `PUT /api/users/me` - Cập nhật profile
- `GET /api/users/me/orders` - Đơn hàng của tôi
- `GET /api/users/me/notifications` - Thông báo

### Products
- `GET /api/products` - Danh sách sản phẩm
- `GET /api/products/:id` - Chi tiết sản phẩm
- `POST /api/products` - Tạo sản phẩm (Seller)
- `PUT /api/products/:id` - Cập nhật sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm

### Categories
- `GET /api/categories` - Danh sách danh mục
- `GET /api/categories/:id` - Chi tiết danh mục
- `POST /api/categories` - Tạo danh mục (Admin)
- `PUT /api/categories/:id` - Cập nhật danh mục
- `DELETE /api/categories/:id` - Xóa danh mục

### Cart
- `GET /api/cart` - Lấy giỏ hàng
- `POST /api/cart/items` - Thêm vào giỏ hàng
- `PUT /api/cart/items/:id` - Cập nhật số lượng
- `DELETE /api/cart/items/:id` - Xóa khỏi giỏ hàng
- `DELETE /api/cart` - Xóa toàn bộ giỏ hàng

### Orders
- `POST /api/orders` - Tạo đơn hàng
- `GET /api/orders` - Danh sách đơn hàng
- `GET /api/orders/:id` - Chi tiết đơn hàng
- `PUT /api/orders/:id/status` - Cập nhật trạng thái
- `POST /api/orders/:id/cancel` - Hủy đơn hàng

### Payments
- `GET /api/payments/methods` - Phương thức thanh toán
- `POST /api/payments/create` - Tạo thanh toán
- `POST /api/payments/webhook/momo` - MoMo webhook
- `POST /api/payments/webhook/sepay` - SePay webhook
- `POST /api/payments/webhook/paypal` - PayPal webhook

### Subscriptions
- `GET /api/subscriptions/plans` - Danh sách gói
- `GET /api/subscriptions/my` - Subscription của tôi
- `POST /api/subscriptions/buy` - Mua subscription
- `GET /api/subscriptions/stats` - Thống kê seller

### Chat
- `GET /api/chat/rooms` - Danh sách phòng chat
- `GET /api/chat/rooms/:roomId/messages` - Tin nhắn
- `POST /api/chat/send` - Gửi tin nhắn
- `GET /api/chat/ai/sessions` - Phiên chat AI
- `POST /api/chat/ai/chat` - Chat với AI

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - Quản lý users
- `PATCH /api/admin/users/:id/role` - Cập nhật role
- `GET /api/admin/products/pending` - Sản phẩm chờ duyệt
- `PATCH /api/admin/products/:id/approve` - Duyệt sản phẩm
- `PATCH /api/admin/products/:id/reject` - Từ chối sản phẩm

## Chạy với Docker

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Variables

Xem `.env.example` để biết các biến môi trường cần thiết.
