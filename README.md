# MINI MARKETPLACE

Nền tảng marketplace cho sản phẩm số: tài khoản, API key, license, file số. Dự án gồm 2 phần tách riêng:

- `Client`: frontend Next.js
- `Server`: backend Express + Prisma + PostgreSQL + Redis

## Kiến trúc

```text
MINI_MARKETPLACE/
├── Client/                  # Next.js App Router frontend
├── Server/                  # Express + Prisma backend
├── MINI MARKETPLACE/        # Bruno API collection
├── PROJECT_SUMMARY.md       # Ghi chú tổng quan dự án
└── Mini_Marketplace_API_Doc.docx
```

## Stack chính

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Framer Motion, Socket.IO Client
- Backend: Express, TypeScript, Prisma, PostgreSQL, Redis, Socket.IO, Zod, JWT
- Tích hợp: Google OAuth, Nodemailer, MoMo, SePay, PayPal
- Hạ tầng dev: Docker Compose cho PostgreSQL, Redis, Mailhog, PgAdmin

## Yêu cầu môi trường

- Node.js `>= 20`
- npm
- PostgreSQL
- Redis
- Docker Desktop hoặc Docker Engine nếu muốn chạy service bằng Compose

## Cổng mặc định

- Frontend dev: `http://localhost:3001`
- Backend API: `http://localhost:3000`
- Health check backend: `http://localhost:3000/health`
- Redis Commander: `http://localhost:8081` khi bật profile `debug`
- PgAdmin: `http://localhost:5050` khi bật profile `debug`
- Mailhog: `http://localhost:8025` khi bật profile `debug`

## Chạy local nhanh nhất

### 1. Cài dependencies

```bash
cd Client && npm install
cd ../Server && npm install
```

### 2. Chuẩn bị biến môi trường backend

```bash
cd Server
cp .env.example .env
```

Tối thiểu cần kiểm tra các biến sau trong `Server/.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://marketplace:marketplace123@localhost:5432/minimarketplace
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3000
JWT_SECRET=your-very-long-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-very-long-refresh-secret-at-least-32-chars
```

### 3. Chuẩn bị biến môi trường frontend

Frontend có fallback mặc định về `http://localhost:3000`, nhưng nên tạo `Client/.env.local` để rõ ràng:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

Tùy chọn nếu dùng route gif:

```env
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-key
```

### 4. Khởi động PostgreSQL và Redis

Cách nhanh nhất là dùng Docker Compose trong thư mục `Server`:

```bash
cd Server
docker compose up -d postgres redis
```

Nếu muốn bật thêm công cụ debug:

```bash
cd Server
docker compose --profile debug up -d postgres redis redis-commander pgadmin mailhog
```

### 5. Khởi tạo database

```bash
cd Server
npm run db:generate
npm run db:migrate
npm run db:seed
```

Nếu bạn chỉ muốn đồng bộ schema nhanh trong môi trường dev:

```bash
npm run db:push
```

### 6. Chạy backend

```bash
cd Server
npm run dev
```

### 7. Chạy frontend

```bash
cd Client
npm run dev
```

Sau đó truy cập:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`

## Scripts

### Client

```bash
cd Client

npm run dev         # chạy frontend dev ở port 3001
npm run build       # build production
npm run start       # start production server
npm run typecheck   # kiểm tra TypeScript
```

Nếu `next build` gặp vấn đề với Turbopack trong môi trường hạn chế, có thể dùng:

```bash
npm run build -- --webpack
```

### Server

```bash
cd Server

npm run dev             # chạy backend dev
npm run build           # build TypeScript ra dist/
npm run build:fast      # build bằng esbuild
npm run start           # chạy bản build production
npm run lint            # chạy ESLint
npm run lint:fix        # tự sửa một số lỗi lint
npm run test            # chạy unit test
npm run test:watch      # test watch mode
npm run test:coverage   # test + coverage
npm run db:generate     # generate Prisma client
npm run db:push         # push schema
npm run db:migrate      # migrate database
npm run db:migrate:prod # deploy migration production
npm run db:seed         # seed dữ liệu mẫu
npm run db:studio       # mở Prisma Studio
npm run db:reset        # reset database dev
```

## Build production

### Backend

```bash
cd Server
npm run build
npm run start
```

### Frontend

```bash
cd Client
npm run build
npm run start -- -p 3001
```

Lưu ý:

- `Client` và `Server` là 2 project npm riêng, không dùng workspace root.
- Backend production cần database, redis và đầy đủ biến môi trường thanh toán/email nếu dùng các tính năng đó.

## Docker

`Server/docker-compose.yml` hiện tập trung cho backend và hạ tầng phụ trợ.

Chạy toàn bộ stack backend bằng Compose:

```bash
cd Server
docker compose up -d --build
```

Chạy kèm công cụ debug:

```bash
cd Server
docker compose --profile debug up -d --build
```

Dừng stack:

```bash
cd Server
docker compose down
```

## Tài liệu API và công cụ test

- Backend README chi tiết: [Server/README.md](./Server/README.md)
- Bruno collection: thư mục [MINI MARKETPLACE](./MINI%20MARKETPLACE/)
- API doc tĩnh: [Server/docs/index.html](./Server/docs/index.html)
- Tổng quan kỹ thuật: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)

## Một số biến môi trường quan trọng

### Backend bắt buộc để chạy cơ bản

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `BACKEND_URL`

### Backend tùy chọn theo tính năng

- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- MoMo: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT`
- SePay: `SEPAY_ENV`, `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `SEPAY_IPN_TOKEN`, `SEPAY_API_TOKEN`
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_GIPHY_API_KEY`

## Checklist trước khi deploy

1. Đổi toàn bộ secret mặc định trong `Server/.env`.
2. Trỏ `FRONTEND_URL` và `BACKEND_URL` sang domain thật.
3. Chạy `npm run build` cho cả `Client` và `Server`.
4. Chạy `npm run lint` và `npm run test` cho `Server`.
5. Chạy `npm run db:migrate:prod` trên database production.
6. Kiểm tra cấu hình SMTP, OAuth và payment webhook.
7. Kiểm tra CORS, cookie domain, callback URL và webhook URL theo domain production.

## Ghi chú

- Thư mục `Server/uploads/` dùng cho file runtime và hiện đã được cấu hình `.gitignore`.
- Thư mục `Server/logs/` được tạo tự động khi backend chạy ở development.
- Nếu chỉ cần chạy giao diện với API local mặc định, frontend có thể hoạt động mà không cần thêm `Client/.env.local`.
