// ===== API DATA =====
const API_GROUPS = [
  {
    group: "Authentication",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    endpoints: [
      { method: "POST", path: "/auth/register", auth: "None", rateLimit: "authLimiter", desc: "Đăng ký tài khoản mới", body: [
          { name: "name", type: "string", required: true, note: "1-100 ký tự" },
          { name: "email", type: "string", required: true, example: "user@example.com" },
          { name: "password", type: "string", required: true, note: "≥8 ký tự, A-Z, a-z, 0-9, đặc biệt" }
        ]
      },
      { method: "POST", path: "/auth/login", auth: "None", rateLimit: "authLimiter", desc: "Đăng nhập — gửi email thông báo đăng nhập (IP, thiết bị)", body: [
          { name: "email", type: "string", required: true, example: "user@example.com" },
          { name: "password", type: "string", required: true }
        ]
      },
      { method: "POST", path: "/auth/logout", auth: "Optional", desc: "Đăng xuất — xóa refresh token" },
      { method: "POST", path: "/auth/refresh", auth: "None", rateLimit: "strictLimiter", desc: "Làm mới access token bằng refresh token (cookie)" },
      { method: "GET/POST", path: "/auth/verify-email", auth: "None", desc: "Xác minh email qua token trong URL (GET: browser, POST: API)" },
      { method: "POST", path: "/auth/resend-verification", auth: "None", rateLimit: "authLimiter", desc: "Gửi lại email xác minh", body: [
          { name: "email", type: "string", required: true, example: "user@example.com" }
        ]
      },
      { method: "POST", path: "/auth/forgot-password", auth: "None", rateLimit: "authLimiter", desc: "Yêu cầu đặt lại mật khẩu — gửi link qua email", body: [
          { name: "email", type: "string", required: true, example: "user@example.com" }
        ]
      },
      { method: "POST", path: "/auth/reset-password", auth: "None", rateLimit: "strictLimiter", desc: "Đặt lại mật khẩu với token", body: [
          { name: "token", type: "string", required: true },
          { name: "password", type: "string", required: true, note: "≥8 ký tự, có A-Z, a-z, 0-9, ký tự đặc biệt" }
        ]
      },
      { method: "POST", path: "/auth/change-password", auth: "Bearer", desc: "Đổi mật khẩu khi đã đăng nhập", body: [
          { name: "currentPassword", type: "string", required: true },
          { name: "newPassword", type: "string", required: true, note: "≥8 ký tự, A-Z, a-z, 0-9, đặc biệt" }
        ]
      },
      { method: "POST", path: "/auth/google", auth: "None", rateLimit: "authLimiter", desc: "Đăng nhập/đăng ký bằng Google OAuth", body: [
          { name: "idToken", type: "string", required: true, note: "Google ID Token từ Google Sign-In" }
        ]
      },
      { method: "GET", path: "/auth/me", auth: "Bearer", desc: "Lấy thông tin user hiện tại" },
      { method: "POST", path: "/auth/delete-account", auth: "Bearer", desc: "Xóa tài khoản", body: [
          { name: "confirmPassword", type: "string", required: true }
        ]
      }
    ]
  },
  {
    group: "User Profile",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    endpoints: [
      { method: "GET", path: "/users/me", auth: "Bearer", desc: "Lấy thông tin profile của user hiện tại" },
      { method: "PUT", path: "/users/me", auth: "Bearer", desc: "Cập nhật profile", body: [
          { name: "name", type: "string", note: "1-100 ký tự" },
          { name: "phone", type: "string" },
          { name: "avatar", type: "string", note: "URL ảnh" },
          { name: "bio", type: "string", note: "≤500 ký tự" },
          { name: "address", type: "string", note: "≤300 ký tự" }
        ]
      },
      { method: "GET", path: "/users/me/orders", auth: "Bearer", desc: "Danh sách đơn hàng (buyer)" },
      { method: "GET", path: "/users/me/seller/orders", auth: "Bearer + Seller", desc: "Danh sách đơn hàng với tư cách seller" },
      { method: "GET", path: "/users/me/notifications", auth: "Bearer", desc: "Danh sách thông báo" },
      { method: "PATCH", path: "/users/me/notifications/:id/read", auth: "Bearer", desc: "Đánh dấu đã đọc 1 thông báo" },
      { method: "PATCH", path: "/users/me/notifications/read-all", auth: "Bearer", desc: "Đánh dấu đã đọc tất cả thông báo" }
    ]
  },
  {
    group: "Products",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    endpoints: [
      { method: "GET", path: "/products", auth: "None", desc: "Danh sách sản phẩm (public) — hỗ trợ filter, sort, pagination" },
      { method: "GET", path: "/products/:id", auth: "Optional", desc: "Chi tiết sản phẩm" },
      { method: "POST", path: "/products", auth: "Bearer + Seller", desc: "Tạo sản phẩm mới", body: [
          { name: "name", type: "string", required: true, note: "1-200 ký tự" },
          { name: "description", type: "string" },
          { name: "price", type: "number", required: true, note: ">0" },
          { name: "categoryId", type: "string", required: true },
          { name: "type", type: "enum", default: "ACCOUNT", note: "ACCOUNT / KEY / FILE" },
          { name: "stock", type: "number", default: "1", note: "≥0" },
          { name: "images", type: "array<string>" },
          { name: "metadata", type: "object" }
        ]
      },
      { method: "PUT", path: "/products/:id", auth: "Bearer (owner)", desc: "Cập nhật sản phẩm" },
      { method: "DELETE", path: "/products/:id", auth: "Bearer (owner)", desc: "Xóa sản phẩm" },
      { method: "GET", path: "/products/seller/my", auth: "Bearer + Seller", desc: "Danh sách sản phẩm của seller" },
      { method: "PATCH", path: "/products/:id/approve", auth: "Bearer + Admin", desc: "Duyệt sản phẩm" },
      { method: "PATCH", path: "/products/:id/reject", auth: "Bearer + Admin", desc: "Từ chối sản phẩm", body: [
          { name: "reason", type: "string", note: "Lý do từ chối" }
        ]
      }
    ]
  },
  {
    group: "Categories",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    endpoints: [
      { method: "GET", path: "/categories", auth: "None", desc: "Danh sách danh mục (public)" },
      { method: "GET", path: "/categories/:id", auth: "None", desc: "Chi tiết danh mục" },
      { method: "POST", path: "/categories", auth: "Bearer + Admin", desc: "Tạo danh mục mới", body: [
          { name: "name", type: "string", required: true },
          { name: "slug", type: "string" },
          { name: "parentId", type: "number" }
        ]
      },
      { method: "PUT", path: "/categories/:id", auth: "Bearer + Admin", desc: "Cập nhật danh mục", body: [
          { name: "name", type: "string" },
          { name: "slug", type: "string" }
        ]
      },
      { method: "DELETE", path: "/categories/:id", auth: "Bearer + Admin", desc: "Xóa danh mục" }
    ]
  },
  {
    group: "Orders",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    endpoints: [
      { method: "POST", path: "/orders", auth: "Bearer", desc: "Tạo đơn hàng mới", body: [
          { name: "items", type: "array", required: true, note: "[{productId, quantity}]" },
          { name: "paymentMethod", type: "enum", default: "PLATFORM", note: "PLATFORM / MOMO / SEPAY / PAYPAL / BANK_TRANSFER" }
        ]
      },
      { method: "GET", path: "/orders", auth: "Bearer", desc: "Danh sách đơn hàng (buyer)" },
      { method: "GET", path: "/orders/seller", auth: "Bearer", desc: "Danh sách đơn hàng (seller)" },
      { method: "GET", path: "/orders/:id", auth: "Bearer", desc: "Chi tiết đơn hàng" },
      { method: "PATCH", path: "/orders/:id/status", auth: "Bearer", desc: "Cập nhật trạng thái đơn hàng", body: [
          { name: "status", type: "enum", required: true, note: "PENDING / CONFIRMED / PROCESSING / SHIPPED / DELIVERED / CANCELLED / REFUNDED / PAID / FAILED" }
        ]
      },
      { method: "PATCH", path: "/orders/:id/cancel", auth: "Bearer", desc: "Hủy đơn hàng" }
    ]
  },
  {
    group: "Cart",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    endpoints: [
      { method: "GET", path: "/cart", auth: "Bearer", desc: "Lấy giỏ hàng" },
      { method: "POST", path: "/cart/items", auth: "Bearer", desc: "Thêm sản phẩm vào giỏ hàng", body: [
          { name: "productId", type: "string", required: true },
          { name: "quantity", type: "number", default: "1", note: ">0" }
        ]
      },
      { method: "PUT", path: "/cart/items/:id", auth: "Bearer", desc: "Cập nhật số lượng trong giỏ hàng", body: [
          { name: "quantity", type: "number", required: true, note: ">0" }
        ]
      },
      { method: "DELETE", path: "/cart/items/:id", auth: "Bearer", desc: "Xóa sản phẩm khỏi giỏ hàng" },
      { method: "DELETE", path: "/cart", auth: "Bearer", desc: "Xóa toàn bộ giỏ hàng" }
    ]
  },
  {
    group: "Wishlist",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    endpoints: [
      { method: "GET", path: "/wishlist", auth: "Bearer", desc: "Lấy danh sách yêu thích" },
      { method: "POST", path: "/wishlist", auth: "Bearer", desc: "Thêm vào wishlist", body: [
          { name: "productId", type: "string", required: true }
        ]
      },
      { method: "GET", path: "/wishlist/:productId/check", auth: "Bearer", desc: "Kiểm tra sản phẩm có trong wishlist không" },
      { method: "DELETE", path: "/wishlist/:productId", auth: "Bearer", desc: "Xóa khỏi wishlist" }
    ]
  },
  {
    group: "Reviews",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    endpoints: [
      { method: "GET", path: "/reviews/product/:productId", auth: "None", desc: "Danh sách đánh giá sản phẩm" },
      { method: "POST", path: "/reviews", auth: "Bearer", desc: "Tạo đánh giá", body: [
          { name: "productId", type: "string", required: true },
          { name: "rating", type: "number", required: true, note: "1-5" },
          { name: "content", type: "string", required: true, note: "10-1000 ký tự" }
        ]
      },
      { method: "PUT", path: "/reviews/:id", auth: "Bearer (owner)", desc: "Cập nhật đánh giá", body: [
          { name: "rating", type: "number", note: "1-5" },
          { name: "content", type: "string", note: "10-1000 ký tự" }
        ]
      },
      { method: "DELETE", path: "/reviews/:id", auth: "Bearer (owner)", desc: "Xóa đánh giá" }
    ]
  },
  {
    group: "Subscriptions",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    endpoints: [
      { method: "GET", path: "/subscriptions/plans", auth: "None", desc: "Lấy danh sách gói subscription" },
      { method: "GET", path: "/subscriptions/my", auth: "Bearer", desc: "Lấy subscription hiện tại của user" },
      { method: "POST", path: "/subscriptions/buy", auth: "Bearer", desc: "Mua subscription", body: [
          { name: "planId", type: "string", required: true },
          { name: "paymentMethod", type: "enum", default: "PLATFORM" }
        ]
      },
      { method: "GET", path: "/subscriptions/stats", auth: "Bearer + Seller", desc: "Thống kê subscription của seller" },
      { method: "GET", path: "/subscriptions/payment-configs", auth: "Bearer + Seller", desc: "Lấy cấu hình thanh toán" },
      { method: "POST", path: "/subscriptions/payment-configs", auth: "Bearer + Seller", desc: "Tạo cấu hình thanh toán", body: [
          { name: "method", type: "enum", required: true, note: "MOMO / SEPAY / PAYPAL / BANK_TRANSFER" },
          { name: "config", type: "object", required: true }
        ]
      },
      { method: "PUT", path: "/subscriptions/payment-configs/:id", auth: "Bearer + Seller", desc: "Cập nhật cấu hình thanh toán", body: [
          { name: "config", type: "object" },
          { name: "isActive", type: "boolean" }
        ]
      },
      { method: "DELETE", path: "/subscriptions/payment-configs/:id", auth: "Bearer + Seller", desc: "Xóa cấu hình thanh toán" }
    ]
  },
  {
    group: "Payments",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    endpoints: [
      { method: "GET", path: "/payments/methods", auth: "None", desc: "Lấy danh sách phương thức thanh toán" },
      { method: "POST", path: "/payments/create", auth: "Bearer", rateLimit: "strictLimiter", desc: "Tạo thanh toán cho đơn hàng", body: [
          { name: "orderId", type: "string", required: true },
          { name: "method", type: "enum", required: true, note: "MOMO / SEPAY / PAYPAL / BANK_TRANSFER" }
        ]
      },
      { method: "GET", path: "/payments/history", auth: "Bearer", desc: "Lịch sử thanh toán" },
      { method: "POST", path: "/payments/webhook/momo", auth: "Webhook Signature", desc: "Webhook MoMo — xử lý callback từ MoMo" },
      { method: "POST", path: "/payments/webhook/sepay", auth: "Webhook Signature", desc: "Webhook SePay — xử lý callback từ SePay" },
      { method: "POST", path: "/payments/webhook/paypal", auth: "Webhook Signature", desc: "Webhook PayPal — xử lý IPN từ PayPal" }
    ]
  },
  {
    group: "Admin",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    endpoints: [
      { method: "GET", path: "/admin/dashboard", auth: "Bearer + Admin", desc: "Thống kê dashboard tổng quan" },
      { method: "GET", path: "/admin/users", auth: "Bearer + Admin", desc: "Danh sách users" },
      { method: "PATCH", path: "/admin/users/:id/role", auth: "Bearer + Admin", desc: "Cập nhật vai trò user", body: [
          { name: "role", type: "enum", required: true, note: "USER / SELLER / ADMIN" }
        ]
      },
      { method: "PATCH", path: "/admin/users/:id/suspend", auth: "Bearer + Admin", desc: "Khóa / mở khóa user", body: [
          { name: "isActive", type: "boolean", required: true }
        ]
      },
      { method: "GET", path: "/admin/products/pending", auth: "Bearer + Admin", desc: "Danh sách sản phẩm chờ duyệt" },
      { method: "PATCH", path: "/admin/products/:id/approve", auth: "Bearer + Admin", desc: "Duyệt sản phẩm" },
      { method: "PATCH", path: "/admin/products/:id/reject", auth: "Bearer + Admin", desc: "Từ chối sản phẩm", body: [
          { name: "reason", type: "string" }
        ]
      },
      { method: "GET", path: "/admin/plans", auth: "Bearer + Admin", desc: "Danh sách gói subscription" },
      { method: "POST", path: "/admin/plans", auth: "Bearer + Admin", desc: "Tạo gói subscription", body: [
          { name: "id", type: "string", required: true },
          { name: "name", type: "string", required: true },
          { name: "price", type: "number", required: true },
          { name: "duration", type: "number", required: true, note: "Số ngày" },
          { name: "features", type: "array<string>" }
        ]
      },
      { method: "PATCH", path: "/admin/plans/:id", auth: "Bearer + Admin", desc: "Cập nhật gói subscription", body: [
          { name: "name", type: "string" },
          { name: "price", type: "number" },
          { name: "features", type: "array<string>" },
          { name: "isActive", type: "boolean" }
        ]
      },
      { method: "DELETE", path: "/admin/plans/:id", auth: "Bearer + Admin", desc: "Xóa gói subscription" },
      { method: "GET", path: "/admin/activity-logs", auth: "Bearer + Admin", desc: "Lịch sử hoạt động hệ thống" }
    ]
  },
  {
    group: "Payouts",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    endpoints: [
      { method: "GET", path: "/payouts", auth: "Bearer", desc: "Danh sách payout của seller" },
      { method: "GET", path: "/payouts/summary", auth: "Bearer", desc: "Tổng hợp thu nhập" },
      { method: "GET", path: "/payouts/all", auth: "Bearer + Admin", desc: "Tất cả payouts (admin)" },
      { method: "PATCH", path: "/payouts/:id", auth: "Bearer + Admin", desc: "Cập nhật trạng thái payout", body: [
          { name: "status", type: "enum", required: true, note: "PENDING / PROCESSING / COMPLETED / FAILED" }
        ]
      }
    ]
  },
  {
    group: "Chat & AI",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    endpoints: [
      { method: "GET", path: "/chat/rooms", auth: "Bearer", desc: "Danh sách phòng chat" },
      { method: "GET", path: "/chat/rooms/:roomId/messages", auth: "Bearer", desc: "Tin nhắn trong phòng chat" },
      { method: "POST", path: "/chat/send", auth: "Bearer", desc: "Gửi tin nhắn", body: [
          { name: "roomId", type: "string", required: true },
          { name: "receiverId", type: "number" },
          { name: "content", type: "string", required: true }
        ]
      },
      { method: "GET", path: "/chat/ai/sessions", auth: "Bearer", desc: "Danh sách phiên AI chat" },
      { method: "GET", path: "/chat/ai/sessions/:sessionId/history", auth: "Bearer", desc: "Lịch sử chat với AI" },
      { method: "POST", path: "/chat/ai/chat", auth: "Bearer", desc: "Chat với AI assistant", body: [
          { name: "sessionId", type: "number" },
          { name: "message", type: "string", required: true },
          { name: "context", type: "string", default: "default" }
        ]
      }
    ]
  }
];

// ===== UTILITIES =====
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getMethodClass(method) {
  const map = {
    GET: 'method-get', POST: 'method-post', PUT: 'method-put',
    PATCH: 'method-patch', DELETE: 'method-delete'
  };
  return map[method] || 'method-ghost';
}

function makeEndpointId(groupName, ep) {
  const g = slugify(groupName);
  const firstMethod = ep.method.split('/')[0].toLowerCase();
  const cleanPath = ep.path.replace(/^\//, '').replace(/[\/:]/g, '-').replace(/-$/, '');
  return g + '-' + firstMethod + '-' + cleanPath;
}

// ===== BUILD ENDPOINT CARD =====
function buildEndpointCard(ep, groupName) {
  const methodClass = getMethodClass(ep.method.split('/')[0]);
  const authIsProtected = ep.auth === 'Bearer' ||
    (typeof ep.auth === 'string' && ep.auth.includes('Bearer'));
  const authText = ep.auth === 'None' ? 'Public' :
    (ep.auth === 'Optional' ? 'Optional' : ep.auth);

  const epId = makeEndpointId(groupName, ep);

  let html = `<div class="endpoint-card" id="${epId}">
    <div class="endpoint-header">
      <span class="${methodClass}">${ep.method}</span>
      <code>${ep.path}</code>`;

  if (ep.rateLimit) {
    html += `<span class="rate-tag">${ep.rateLimit}</span>`;
  }

  html += `<span class="auth-tag${authIsProtected ? ' protected' : ''}">${authText}</span>
    </div>
    <div class="endpoint-desc">${ep.desc}</div>`;

  if (ep.body && ep.body.length > 0) {
    html += `<div class="endpoint-body">
      <div class="body-section">
        <div class="body-section-title">Request Body</div>
        <table class="param-table">
          <thead><tr>
            <th>Field</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th>
          </tr></thead>
          <tbody>`;
    ep.body.forEach(function(p) {
      html += `<tr>
        <td><span class="param-name">${p.name}</span></td>
        <td><span class="param-type">${p.type}</span></td>
        <td>${p.required ? '<span class="param-required">Required</span>' : ''}</td>
        <td><span class="param-default">${p.default || '—'}</span></td>
        <td><span class="param-note">${p.note || ''}</span></td>
      </tr>`;
    });
    html += `</tbody></table></div></div>`;
  }

  html += `</div>`;
  return html;
}

// ===== BUILD GROUP SECTION =====
function buildGroupSection(group) {
  const groupId = 'group-' + slugify(group.group);
  const cardsHtml = group.endpoints.map(function(ep) {
    return buildEndpointCard(ep, group.group);
  }).join('');
  return `<div id="${groupId}">
    <div class="section-divider"><span>${group.group}</span></div>
    <div class="group-header">
      <div class="group-title">${group.icon} ${group.group}</div>
      <div class="group-meta">${group.endpoints.length} endpoints</div>
    </div>
    ${cardsHtml}
  </div>`;
}

// ===== INJECT CONTENT =====
var container = document.getElementById('endpointsContainer');
if (container) {
  container.innerHTML = API_GROUPS.map(buildGroupSection).join('');
}

// ===== BUILD NAVIGATION =====
var navGroups = document.getElementById('navGroups');
if (navGroups) {
  var navHtml = '';
  API_GROUPS.forEach(function(group) {
    navHtml += '<div class="nav-group"><div class="nav-group-label"><span>' + group.group + '</span></div>';
    group.endpoints.forEach(function(ep) {
      var epId = makeEndpointId(group.group, ep);
      var method = ep.method.split('/')[0];
      var mc = getMethodClass(method);
      var shortLabel = ep.path.split('/').pop() || ep.path;
      navHtml += '<a href="#' + epId + '" class="nav-item" data-section="' + epId + '">' +
        '<span class="' + mc + ' method-mini">' + method + '</span>' +
        '<span class="nav-label">' + shortLabel + '</span></a>';
    });
    navHtml += '</div>';
  });
  navGroups.innerHTML += navHtml;
}

// ===== THEME =====
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
['themeToggle', 'themeToggle2'].forEach(function(id) {
  var btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
});
var savedTheme = localStorage.getItem('theme');
if (savedTheme) setTheme(savedTheme);

// ===== MOBILE SIDEBAR =====
var menuBtn = document.getElementById('menuBtn');
var sidebar = document.getElementById('sidebar');
if (menuBtn) {
  menuBtn.addEventListener('click', function() {
    sidebar && sidebar.classList.toggle('open');
  });
}
document.addEventListener('click', function(e) {
  if (sidebar && sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ===== SMOOTH SCROLL FOR ALL ANCHOR LINKS =====
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="#"]');
  if (!link) return;
  var hash = link.getAttribute('href');
  if (!hash || hash === '#') return;
  var id = hash.substring(1);
  var target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  sidebar && sidebar.classList.remove('open');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.pushState(null, '', hash);
  updateActiveNav(id);
});

// ===== UPDATE ACTIVE NAV =====
function updateActiveNav(sectionId) {
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.remove('active');
  });
  var active = document.querySelector('.nav-item[data-section="' + CSS.escape(sectionId) + '"]');
  if (active) {
    active.classList.add('active');
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ===== INTERSECTION OBSERVER — highlight nav on scroll =====
var scrollObs = null;
function setupScrollObserver() {
  if (scrollObs) scrollObs.disconnect();
  scrollObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        updateActiveNav(entry.target.id);
      }
    });
  }, { threshold: 0.1, rootMargin: '-80px 0px -70% 0px' });
  document.querySelectorAll('.endpoint-card[id]').forEach(function(el) {
    scrollObs.observe(el);
  });
}
setupScrollObserver();

// ===== MAIN TABS (overview, errors etc) =====
document.addEventListener('click', function(e) {
  var tab = e.target.closest('.tab');
  if (!tab) return;
  var parent = tab.closest('.tabs');
  if (!parent) return;
  parent.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  tab.classList.add('active');
  var panelContainer = parent.nextElementSibling;
  if (!panelContainer) return;
  panelContainer.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var target = document.getElementById(tab.dataset.tab);
  if (target) target.classList.add('active');
});

// ===== COPY BUTTONS =====
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.copy-btn');
  if (!btn) return;
  var raw = (btn.dataset.copy || '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<br\s*\/?>/gi, '\n');
  navigator.clipboard.writeText(raw).then(function() {
    var orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 6 4 6"/></svg> Copied!';
    setTimeout(function() {
      btn.classList.remove('copied');
      btn.innerHTML = orig;
    }, 1500);
  }).catch(function() {});
});

// ===== SEARCH =====
var searchInput = document.getElementById('searchInput');
var searchOverlay = document.getElementById('searchOverlay');
var searchModal = document.getElementById('searchModal');
var searchResults = document.getElementById('searchResults');

// Build search index
var searchIndex = [];
API_GROUPS.forEach(function(group) {
  group.endpoints.forEach(function(ep) {
    var epId = makeEndpointId(group.group, ep);
    searchIndex.push({
      id: epId,
      group: group.group,
      method: ep.method.split('/')[0],
      path: ep.path,
      desc: ep.desc,
      full: group.group + ' ' + ep.method + ' ' + ep.path + ' ' + ep.desc
    });
  });
});

function doSearch(query) {
  if (!searchResults) return;
  if (!query.trim()) {
    searchResults.innerHTML = '<div class="search-empty">Gõ để tìm kiếm endpoints...</div>';
    return;
  }
  var q = query.toLowerCase();
  var results = searchIndex.filter(function(item) {
    return item.full.toLowerCase().indexOf(q) !== -1;
  });
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">Không tìm thấy kết quả</div>';
    return;
  }
  var html = '';
  results.slice(0, 12).forEach(function(r) {
    var mc = getMethodClass(r.method);
    html += '<div class="search-result-item" data-id="' + r.id + '">' +
      '<span class="' + mc + ' method-mini">' + r.method + '</span>' +
      '<div class="result-info">' +
        '<code class="result-path">' + r.path + '</code>' +
        '<span class="result-desc">' + r.desc + '</span>' +
      '</div>' +
      '<span class="result-group">' + r.group + '</span>' +
    '</div>';
  });
  searchResults.innerHTML = html;
}

if (searchInput) searchInput.addEventListener('input', function(e) { doSearch(e.target.value); });
if (searchModal) searchModal.addEventListener('input', function(e) { doSearch(e.target.value); });

// Open with ⌘K / Ctrl+K
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    searchOverlay && searchOverlay.classList.add('active');
    if (searchModal) {
      searchModal.focus();
      searchModal.value = searchInput ? searchInput.value : '';
      doSearch(searchModal.value);
    }
  }
  if (e.key === 'Escape') searchOverlay && searchOverlay.classList.remove('active');
});

if (searchOverlay) {
  searchOverlay.addEventListener('click', function(e) {
    if (e.target === searchOverlay) searchOverlay.classList.remove('active');
  });
}

if (searchResults) {
  searchResults.addEventListener('click', function(e) {
    var item = e.target.closest('.search-result-item');
    if (!item) return;
    var id = item.dataset.id;
    searchOverlay && searchOverlay.classList.remove('active');
    sidebar && sidebar.classList.remove('open');
    var target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', '#' + id);
      updateActiveNav(id);
      target.style.outline = '2px solid var(--accent)';
      target.style.outlineOffset = '4px';
      setTimeout(function() {
        target.style.outline = '';
        target.style.outlineOffset = '';
      }, 2000);
    }
  });
}

// ===== URL HASH ON LOAD =====
window.addEventListener('DOMContentLoaded', function() {
  var hash = window.location.hash.substring(1);
  if (hash) {
    setTimeout(function() {
      var target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveNav(hash);
      }
    }, 300);
  }
});
