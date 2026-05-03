export type ProductType = "account" | "key";

export type Product = {
  slug: string;
  type: ProductType;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  unit: string;
  badge: string;
  stock: number;
  delivery: string;
  warranty: string;
  features: string[];
  detail: string[];
};

export const productTypeLabels: Record<ProductType, string> = {
  account: "Tài khoản",
  key: "Key",
};

export const products: Product[] = [
  {
    slug: "workspace-starter-account",
    type: "account",
    title: "Tài khoản Workspace Starter",
    subtitle: "Tài khoản làm việc sẵn sàng kích hoạt cho team nhỏ.",
    description:
      "Gói account hợp lệ cho nhóm cần bắt đầu nhanh với email, lưu trữ và quyền truy cập cơ bản.",
    price: 129000,
    unit: "account",
    badge: "Giao trong 5 phút",
    stock: 42,
    delivery: "Tự động gửi thông tin sau thanh toán",
    warranty: "Bảo hành đăng nhập 7 ngày",
    features: ["Thông tin đăng nhập riêng", "Hướng dẫn đổi mật khẩu", "Hỗ trợ 2FA nếu cần"],
    detail: [
      "Kiểm tra tình trạng trước khi bàn giao.",
      "Bàn giao kèm ghi chú cấu hình và các bước bảo mật.",
      "Phù hợp cho freelancer, nhóm nhỏ và tác vụ ngắn hạn.",
    ],
  },
  {
    slug: "design-pro-account",
    type: "account",
    title: "Tài khoản Design Pro",
    subtitle: "Account thiết kế đã kích hoạt, tối ưu cho công việc sáng tạo.",
    description:
      "Gói account thiết kế có sẵn quyền sử dụng, phù hợp tạo banner, social post và tài nguyên thương hiệu.",
    price: 189000,
    unit: "account",
    badge: "Bán chạy",
    stock: 18,
    delivery: "Bàn giao qua email đặt hàng",
    warranty: "Bảo hành 14 ngày",
    features: ["Thư viện mẫu sẵn", "Hướng dẫn chuyển email", "Kiểm tra truy cập trước khi giao"],
    detail: [
      "Phân loại rõ gói cá nhân và gói team.",
      "Thông tin account được đóng gói riêng cho từng đơn.",
      "Hỗ trợ reset thông tin nếu gặp lỗi đăng nhập ban đầu.",
    ],
  },
  {
    slug: "ai-api-key-pack",
    type: "key",
    title: "Gói Key API AI",
    subtitle: "Key API dùng cho automation, chatbot và prototype AI.",
    description:
      "Bộ key API hợp lệ, có giới hạn sử dụng rõ ràng và phần hướng dẫn kết nối nhanh cho developer.",
    price: 249000,
    unit: "key",
    badge: "Có invoice",
    stock: 27,
    delivery: "Hiện key trong khu vực đơn hàng",
    warranty: "Đổi key nếu lỗi trong 24 giờ",
    features: ["Quota minh bạch", "Hướng dẫn biến môi trường", "Phù hợp staging và demo"],
    detail: [
      "Key được bàn giao riêng từng đơn, không hiển thị công khai.",
      "Kèm checklist bảo mật để tránh lộ token trong source code.",
      "Phù hợp với luồng request thử nghiệm và công cụ nội bộ.",
    ],
  },
  {
    slug: "proxy-api-key",
    type: "key",
    title: "Key API Proxy",
    subtitle: "Key truy cập API proxy cho tác vụ crawl và kiểm thử.",
    description:
      "Gói key proxy API với thông số endpoint, giới hạn request và tài liệu kết nối để tích hợp nhanh.",
    price: 99000,
    unit: "key",
    badge: "Giá tốt",
    stock: 64,
    delivery: "Nhận endpoint và token ngay",
    warranty: "Bảo hành token 3 ngày",
    features: ["Endpoint rõ ràng", "Rate limit công khai", "Mẫu curl và fetch"],
    detail: [
      "Đính kèm thông số endpoint, header và giới hạn request.",
      "Thích hợp test hệ thống, monitoring và scraping dữ liệu được phép.",
      "Có hướng dẫn xoay key và thu hồi key khi không còn sử dụng.",
    ],
  },
  {
    slug: "license-key-suite",
    type: "key",
    title: "Gói Key Bản Quyền",
    subtitle: "Key bản quyền cho bộ công cụ văn phòng và tiện ích.",
    description:
      "Key kích hoạt phần mềm hợp lệ với trạng thái tồn kho rõ ràng, hỗ trợ kích hoạt nhanh.",
    price: 159000,
    unit: "key",
    badge: "Kích hoạt nhanh",
    stock: 31,
    delivery: "Nhận key và hướng dẫn kích hoạt",
    warranty: "Bảo hành kích hoạt 7 ngày",
    features: ["Kiểm tra key trước giao", "Hướng dẫn từng bước", "Hỗ trợ lỗi kích hoạt"],
    detail: [
      "Key được quản lý theo mã đơn để tránh trùng lặp.",
      "Phù hợp cả máy cá nhân và máy làm việc nội bộ.",
      "Thông tin kích hoạt được trình bày ngắn gọn để người mua tự thao tác.",
    ],
  },
  {
    slug: "streaming-shared-account",
    type: "account",
    title: "Tài khoản Giải Trí Chung",
    subtitle: "Account giải trí có slot riêng, phù hợp sử dụng cá nhân.",
    description:
      "Gói account giải trí bàn giao theo slot, có quy tắc sử dụng và kênh hỗ trợ khi cần đổi thông tin.",
    price: 79000,
    unit: "slot",
    badge: "Tồn kho mới",
    stock: 53,
    delivery: "Nhận thông tin slot riêng",
    warranty: "Bảo hành slot 7 ngày",
    features: ["Slot riêng để quản lý", "Quy tắc sử dụng rõ", "Hỗ trợ đổi nếu lỗi truy cập"],
    detail: [
      "Thông tin bàn giao tách riêng theo từng đơn.",
      "Phù hợp người dùng cần gói ngắn hạn, chi phí gọn.",
      "Có chính sách đổi slot nếu phát sinh lỗi đăng nhập ban đầu.",
    ],
  },
];

export const marketplaceStats = [
  { label: "mặt hàng đang bán", value: "120+" },
  { label: "đơn giao nhanh", value: "98%" },
  { label: "hỗ trợ mỗi ngày", value: "24/7" },
];

export const assurances = [
  {
    title: "Tồn kho rõ ràng",
    text: "Mỗi mặt hàng có trạng thái stock, thời gian giao và điều kiện bảo hành riêng.",
  },
  {
    title: "Bàn giao riêng từng đơn",
    text: "Account và key không hiện công khai; thông tin được đóng gói theo mã đơn hàng.",
  },
  {
    title: "Hướng dẫn bảo mật",
    text: "Mỗi đơn có checklist đổi mật khẩu, cấu hình 2FA hoặc lưu key an toàn.",
  },
];

export function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductsByType(type?: ProductType) {
  if (!type) {
    return products;
  }

  return products.filter((product) => product.type === type);
}
