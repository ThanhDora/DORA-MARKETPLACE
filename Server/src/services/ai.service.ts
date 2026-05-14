import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = (error.response?.data as { error?: { message?: string } } | undefined);
    return data?.error?.message ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

// Ưu tiên Grok (xAI), fallback về OpenAI nếu không có XAI_API_KEY
function resolveProvider(): { apiKey: string; baseURL: string; model: string } | null {
  const xaiKey = process.env.XAI_API_KEY;
  if (xaiKey) {
    return {
      apiKey: xaiKey,
      baseURL: 'https://api.x.ai/v1',
      model: process.env.XAI_MODEL || 'grok-3-mini',
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    };
  }

  return null;
}

export const sendAIChatMessage = async (
  messages: ChatMessage[],
  _context?: string
): Promise<string> => {
  const provider = resolveProvider();

  if (!provider) {
    logger.warn('No AI API key configured (XAI_API_KEY or OPENAI_API_KEY)');
    return 'Xin lỗi, dịch vụ AI đang tạm thời không khả dụng.';
  }

  try {
    const response = await axios.post<ChatCompletionResponse>(
      `${provider.baseURL}/chat/completions`,
      {
        model: provider.model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        timeout: 30000,
      }
    );

    return (
      response.data.choices?.[0]?.message?.content?.trim() ||
      'Xin lỗi, tôi không thể trả lời lúc này.'
    );
  } catch (error: unknown) {
    logger.error({ error: errorMessage(error), provider: provider.baseURL }, 'AI API error');
    return 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn.';
  }
};

// Từ khoá người dùng hay hỏi về thống kê
const STATS_KEYWORDS = [
  'bao nhiêu','tổng','thống kê','số lượng','có những gì','có gì','danh mục',
  'loại nào','phổ biến','bán chạy','hot','nổi bật','mới nhất','giá rẻ',
  'giá thấp','giá cao','rẻ nhất','đắt nhất','nhiều nhất','ít nhất',
  'overview','tổng quan','giới thiệu','dora có','web có','sàn có',
];

export function isStatsQuery(query: string): boolean {
  const q = query.toLowerCase();
  return STATS_KEYWORDS.some((kw) => q.includes(kw));
}

// Lấy thống kê thật từ DB
export const getStatsContext = async (): Promise<string> => {
  const [
    totalApproved,
    byType,
    categories,
    topProductIds,
    recentProducts,
    priceStats,
  ] = await Promise.all([
    prisma.product.count({ where: { status: 'APPROVED', stock: { gt: 0 } } }),

    prisma.product.groupBy({
      by: ['type'],
      where: { status: 'APPROVED', stock: { gt: 0 } },
      _count: { type: true },
    }),

    prisma.category.findMany({
      where: { products: { some: { status: 'APPROVED', stock: { gt: 0 } } } },
      select: {
        name: true,
        _count: { select: { products: true } },
      },
      orderBy: { products: { _count: 'desc' } },
      take: 8,
    }),

    prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 5,
    }),

    prisma.product.findMany({
      where: { status: 'APPROVED', stock: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, name: true, price: true, type: true },
    }),

    prisma.product.aggregate({
      where: { status: 'APPROVED', stock: { gt: 0 } },
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true },
    }),
  ]);

  // Lấy tên sản phẩm bán chạy
  const topIds = topProductIds.map((r) => r.productId);
  const topProducts = topIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topIds }, status: 'APPROVED' },
        select: { id: true, name: true, price: true, type: true },
      })
    : [];

  const base = env.FRONTEND_URL.replace(/\/$/, '');

  const typeMap: Record<string, string> = { ACCOUNT: 'Tài khoản', KEY: 'License/Key', FILE: 'File số' };
  const typeLines = byType.map(
    (t) => `  ${typeMap[t.type] ?? t.type}: ${t._count.type} sản phẩm`
  );
  const catLines = categories.map(
    (c) => `  ${c.name}: ${c._count.products} sản phẩm`
  );
  const topLines = topProducts.map(
    (p, i) => `  ${i + 1}. ${p.name} (${typeMap[p.type] ?? p.type}) — ${Number(p.price).toLocaleString('vi-VN')}đ — ${base}/products/${p.id}`
  );
  const recentLines = recentProducts.map(
    (p) => `  - ${p.name} (${typeMap[p.type] ?? p.type}) — ${Number(p.price).toLocaleString('vi-VN')}đ — ${base}/products/${p.id}`
  );

  const minPrice = Number(priceStats._min.price ?? 0).toLocaleString('vi-VN');
  const maxPrice = Number(priceStats._max.price ?? 0).toLocaleString('vi-VN');
  const avgPrice = Math.round(Number(priceStats._avg.price ?? 0)).toLocaleString('vi-VN');

  return `
[THỐNG KÊ THẬT TỪ DORA — ${new Date().toLocaleDateString('vi-VN')}]
Tổng sản phẩm đang bán: ${totalApproved}
Phân loại:
${typeLines.join('\n')}

Danh mục phổ biến:
${catLines.join('\n')}

Giá bán: từ ${minPrice}đ đến ${maxPrice}đ (trung bình ${avgPrice}đ)

Sản phẩm bán chạy nhất:
${topLines.length ? topLines.join('\n') : '  (chưa có dữ liệu)'}

Sản phẩm mới nhất:
${recentLines.join('\n')}

Dùng dữ liệu trên để trả lời, không bịa số liệu khác.`;
};

// Từ dừng tiếng Việt — không dùng làm từ khoá tìm kiếm
const VI_STOP_WORDS = new Set([
  // Đại từ nhân xưng
  'tôi','bạn','mình','anh','chị','em','ông','bà','họ','chúng','ta',
  // Động từ chung
  'mua','bán','tìm','hỏi','muốn','cần','cho','về','với','xem','dùng',
  // Hư từ
  'và','có','không','là','của','trong','này','được','một','các','những',
  'tại','thì','đây','đó','khi','hay','hoặc','nhưng','vì','nên','đã',
  'sẽ','đang','rất','lắm','quá','thế','nào','gì','ai','đều','cũng',
  'vậy','thôi','nhé','ạ','ơi','ừ','uh','ok','oke','hello','hi','chào',
  'giúp','hỗ','trợ','tư','vấn','biết','hiểu','làm','được',
  // Từ chung về sản phẩm — không dùng làm từ khoá tìm kiếm
  'sản','phẩm','loại','tất','cả','toàn','bộ','nhiều','ít',
  // Tính từ chung — không đặc trưng cho tên sản phẩm
  'mới','cũ','tốt','xịn','rẻ','đắt','nhất','hơn','nhất',
  // Từ duyệt/liệt kê
  'liệt','kê','hiển','thị','danh','sách','gợi','ý','giới','thiệu',
]);

// Từ khoá "duyệt" — user muốn xem danh sách, không tìm sản phẩm cụ thể
const BROWSE_KEYWORDS = [
  'mới nhất','bán chạy','phổ biến','nổi bật','hot','gợi ý','đề xuất',
  'cho tôi xem','liệt kê','danh sách sản phẩm','có những sản phẩm',
  'sản phẩm gì','có gì','xem thử','khám phá',
];

export function isBrowseQuery(query: string): boolean {
  const q = query.toLowerCase();
  return BROWSE_KEYWORDS.some((kw) => q.includes(kw));
}

// Tìm sản phẩm thật trong DB dựa theo từ khóa người dùng nhắn
export const findProductsContext = async (query: string): Promise<string> => {
  const base = env.FRONTEND_URL.replace(/\/$/, '');
  const trimmed = query.trim();

  // Giữ ký tự Unicode, lọc stop words, min 2 ký tự
  const keywords = trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length >= 2 && !VI_STOP_WORDS.has(w))
    .slice(0, 5);

  const fetchRecent = async (label: string) => {
    const items = await prisma.product.findMany({
      where: { status: 'APPROVED', stock: { gt: 0 } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, price: true, type: true, stock: true, category: { select: { name: true } } },
    });
    if (!items.length) return '\nHiện không có sản phẩm nào đang bán.';
    const lines = items.map(
      (p) => `- ${p.name}${p.category ? ` | ${p.category.name}` : ''} | ${Number(p.price).toLocaleString('vi-VN')}đ | Còn ${p.stock} | ${base}/products/${p.id}`
    );
    return `\n${label}:\n${lines.join('\n')}\nChỉ giới thiệu các sản phẩm trên, không bịa thêm.`;
  };

  // Không có keyword đặc trưng → trả danh sách mới nhất
  if (!keywords.length) {
    return fetchRecent('Một số sản phẩm đang bán trên DORA');
  }

  const searchClauses: object[] = [
    { name: { contains: trimmed, mode: 'insensitive' } },
    ...keywords.map((kw) => ({ name: { contains: kw, mode: 'insensitive' } })),
    ...keywords.map((kw) => ({ category: { name: { contains: kw, mode: 'insensitive' } } })),
  ];

  const products = await prisma.product.findMany({
    where: { status: 'APPROVED', stock: { gt: 0 }, OR: searchClauses },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, price: true, type: true, stock: true,
      category: { select: { name: true } },
    },
  });

  // Không tìm thấy sản phẩm cụ thể → trả recent thay vì báo lỗi
  if (!products.length) {
    return fetchRecent('Không tìm thấy sản phẩm khớp, nhưng đây là một số sản phẩm đang bán');
  }

  const lines = products.map(
    (p) =>
      `- ${p.name} | Loại: ${p.type}${p.category ? ` | Danh mục: ${p.category.name}` : ''} | Giá: ${Number(p.price).toLocaleString('vi-VN')}đ | Còn: ${p.stock} | Link: ${base}/products/${p.id}`
  );

  return `\nSản phẩm liên quan trên DORA (dữ liệu thật, đang còn hàng):\n${lines.join('\n')}\nChỉ giới thiệu đúng các sản phẩm này, không bịa tên/giá/link khác.`;
};

export const getAIPromptForContext = async (context?: string): Promise<string> => {
  if (context) {
    const template = await prisma.aIPromptTemplate.findFirst({
      where: { name: context, isActive: true },
    });
    if (template) return template.content;
  }

  const defaultTemplate = await prisma.aIPromptTemplate.findFirst({
    where: { name: 'default', isActive: true },
  });

  return (
    defaultTemplate?.content ||
    `Bạn là trợ lý hỗ trợ của DORA Marketplace — sàn bán sản phẩm số.

DORA có 3 loại sản phẩm: ACCOUNT (tài khoản dịch vụ), KEY (license/API key), FILE (ebook, template, plugin).

Quy trình mua: vào /catalog → chọn sản phẩm → thanh toán (Ví DORA / MoMo / SePay / PayPal) → nhận thông tin ngay trong trang đơn hàng sau khi PAID.
Xem đơn: Tài khoản → Đơn hàng của tôi.
Trạng thái đơn: PENDING → PROCESSING → PAID → DELIVERED. Bị huỷ: CANCELLED.

Quy trình bán: đăng ký Người bán → đăng sản phẩm tại /seller → chờ Admin duyệt → bán được sau khi APPROVED.

Chính sách: sản phẩm số không hoàn tiền sau khi đã giao. Sản phẩm lỗi/sai mô tả → báo hỗ trợ trong 24h.

QUAN TRỌNG — Quy tắc bắt buộc:
- Chỉ giới thiệu sản phẩm có trong danh sách được cung cấp phía dưới (nếu có). KHÔNG tự bịa tên, giá, link, mã giảm giá.
- Trả lời ngắn, 2–4 câu, không dùng bảng hay emoji thừa.
- Không chắc hoặc cần tra đơn cụ thể → đề nghị kết nối nhân viên.`
  );
};

export const processAIChat = async (
  userId: number,
  message: string,
  sessionId?: string,
  context?: string
) => {
  let session;

  if (sessionId) {
    session = await prisma.aIChatSession.findFirst({
      where: { id: Number(sessionId), userId },
    });
  }

  if (!session) {
    session = await prisma.aIChatSession.create({
      data: {
        userId,
        title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        context: context || 'default',
      },
    });
  }

  const history = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  const systemPrompt = await getAIPromptForContext(context);

  const sanitizedMessage = message
    .replace(/<system>/gi, '[system]')
    .replace(/<\|system\|>/gi, '[system]')
    .replace(/ignore previous instructions/gi, '[redacted]')
    .slice(0, 2000);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: sanitizedMessage },
  ];

  const roomId = `ai-${session.id}`;

  const userMessage = await prisma.message.create({
    data: {
      roomId,
      sessionId: session.id,
      senderId: userId,
      receiverId: null,
      content: message,
      role: 'user',
    },
  });

  const aiResponse = await sendAIChatMessage(messages, context);

  const aiMessage = await prisma.message.create({
    data: {
      roomId,
      sessionId: session.id,
      content: aiResponse,
      role: 'assistant',
      senderId: null,
      receiverId: userId,
    },
  });

  await prisma.aIChatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return { sessionId: session.id, userMessage, aiMessage };
};
