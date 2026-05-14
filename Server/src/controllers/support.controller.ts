import { Request, Response } from 'express';
import { SupportTicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { processAIChat, getAIPromptForContext, sendAIChatMessage, findProductsContext, getStatsContext, isStatsQuery, isBrowseQuery } from '../services/ai.service.js';

function uid(req: Request): number {
  return (req as any).user.userId;
}

// ── User: lấy hoặc tạo ticket đang mở ──────────────────────────────────────
export const getOrCreateTicket = async (req: Request, res: Response) => {
  const userId = uid(req);

  let ticket = await prisma.supportTicket.findFirst({
    where: { userId, status: { in: ['AI', 'PENDING_HUMAN', 'WITH_HUMAN'] } },
    include: {
      agent: { select: { id: true, name: true, avatar: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!ticket) {
    ticket = await prisma.supportTicket.create({
      data: { userId },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  sendSuccess(res, ticket);
};

// ── User: lấy messages của ticket ──────────────────────────────────────────
export const getTicketMessages = async (req: Request, res: Response) => {
  const userId = uid(req);
  const ticketId = Number(req.params.id);
  const { page = '1', limit = '50' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');

  const [messages, total] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { ticketId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.supportMessage.count({ where: { ticketId } }),
  ]);

  await prisma.supportMessage.updateMany({
    where: { ticketId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });

  sendList(res, messages, { page: Number(page), limit: Number(limit), total });
};

// ── User: gửi tin nhắn (AI tự trả lời nếu status=AI) ──────────────────────
export const sendUserMessage = async (req: Request, res: Response) => {
  const userId = uid(req);
  const ticketId = Number(req.params.id);
  const { content } = req.body;

  if (!content?.trim()) throw ApiError.badRequest('Nội dung không được trống');

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');
  if (ticket.status === 'CLOSED') throw ApiError.badRequest('Ticket đã đóng');

  const userMsg = await prisma.supportMessage.create({
    data: { ticketId, senderId: userId, content: content.trim(), role: 'user' },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  // Phát realtime qua socket
  const io = (req as any).app.get('io');

  io?.to(`support:${ticketId}`).emit('support:message', userMsg);

  // AI tự động trả lời nếu chưa chuyển sang nhân viên
  if (ticket.status === 'AI') {
    const history = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    const sanitized = content.trim().replace(/<system>/gi, '[system]').slice(0, 2000);

    // Lấy context song song
    const needsStats = isStatsQuery(sanitized);
    const needsBrowse = isBrowseQuery(sanitized);
    // Nếu hỏi thống kê/duyệt → stats context đã có danh sách mới nhất, không cần tìm keyword
    const skipProductSearch = needsStats || needsBrowse;

    const [basePrompt, productCtx, statsCtx] = await Promise.all([
      getAIPromptForContext('support'),
      skipProductSearch ? Promise.resolve('') : findProductsContext(sanitized),
      needsStats || needsBrowse ? getStatsContext() : Promise.resolve(''),
    ]);
    const systemPrompt = basePrompt + productCtx + statsCtx;

    const validHistory = history
      .slice(0, -1)
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'agent')
      .map((m) => ({
        role: (m.role === 'agent' ? 'assistant' : m.role) as 'user' | 'assistant',
        content: m.content,
      }));

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...validHistory,
      { role: 'user' as const, content: sanitized },
    ];

    const aiText = await sendAIChatMessage(messages);

    const aiMsg = await prisma.supportMessage.create({
      data: { ticketId, senderId: null, content: aiText, role: 'assistant' },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

    io?.to(`support:${ticketId}`).emit('support:message', aiMsg);

    return sendSuccess(res, { userMessage: userMsg, aiMessage: aiMsg }, 'Đã gửi', 201);
  }

  sendSuccess(res, { userMessage: userMsg }, 'Đã gửi', 201);
};

// ── User: yêu cầu chuyển sang nhân viên ────────────────────────────────────
export const escalateToHuman = async (req: Request, res: Response) => {
  const userId = uid(req);
  const ticketId = Number(req.params.id);

  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');
  if (ticket.status !== 'AI') throw ApiError.badRequest('Ticket không ở chế độ AI');

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'PENDING_HUMAN', updatedAt: new Date() },
  });

  // Tin nhắn hệ thống thông báo chờ nhân viên
  const sysMsg = await prisma.supportMessage.create({
    data: {
      ticketId,
      senderId: null,
      content: 'Yêu cầu của bạn đã được chuyển đến nhân viên hỗ trợ. Vui lòng chờ trong giây lát.',
      role: 'system',
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  const io = (req as any).app.get('io');
  io?.to(`support:${ticketId}`).emit('support:message', sysMsg);
  io?.to('support:agents').emit('support:new_pending', { ticket: updated });

  sendSuccess(res, { ticket: updated, systemMessage: sysMsg }, 'Đã gửi yêu cầu đến nhân viên');
};

// ── User: đóng ticket ───────────────────────────────────────────────────────
export const closeTicket = async (req: Request, res: Response) => {
  const userId = uid(req);
  const ticketId = Number(req.params.id);

  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');

  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED' } });

  const io = (req as any).app.get('io');
  io?.to(`support:${ticketId}`).emit('support:closed', { ticketId });

  sendSuccess(res, null, 'Đã đóng cuộc trò chuyện');
};

// ── Admin: danh sách tickets ────────────────────────────────────────────────
export const adminListTickets = async (req: Request, res: Response) => {
  const { page = '1', limit = '20', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = {};
  if (status && ['AI', 'PENDING_HUMAN', 'WITH_HUMAN', 'CLOSED'].includes(String(status))) {
    where.status = String(status) as SupportTicketStatus;
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        agent: { select: { id: true, name: true, avatar: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, role: true },
        },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  sendList(res, tickets, { page: Number(page), limit: Number(limit), total });
};

// ── Admin: xem messages của ticket ─────────────────────────────────────────
export const adminGetMessages = async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const { page = '1', limit = '50' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');

  const [messages, total] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { ticketId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.supportMessage.count({ where: { ticketId } }),
  ]);

  sendList(res, messages, { page: Number(page), limit: Number(limit), total });
};

// ── Admin: nhận ticket và trả lời ──────────────────────────────────────────
export const adminReply = async (req: Request, res: Response) => {
  const agentId = uid(req);
  const ticketId = Number(req.params.id);
  const { content } = req.body;

  if (!content?.trim()) throw ApiError.badRequest('Nội dung không được trống');

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');
  if (ticket.status === 'CLOSED') throw ApiError.badRequest('Ticket đã đóng');

  // Nếu chưa assign thì tự assign
  const updates: any = { updatedAt: new Date() };
  if (!ticket.agentId) updates.agentId = agentId;
  if (ticket.status === 'PENDING_HUMAN' || ticket.status === 'AI') updates.status = 'WITH_HUMAN';

  const updated = await prisma.supportTicket.update({ where: { id: ticketId }, data: updates });

  const agentMsg = await prisma.supportMessage.create({
    data: { ticketId, senderId: agentId, content: content.trim(), role: 'agent' },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  const io = (req as any).app.get('io');
  io?.to(`support:${ticketId}`).emit('support:message', agentMsg);

  if (updates.status === 'WITH_HUMAN') {
    const joinMsg = await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: null,
        content: 'Nhân viên hỗ trợ đã tham gia cuộc trò chuyện.',
        role: 'system',
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });
    io?.to(`support:${ticketId}`).emit('support:agent_joined', { ticket: updated, systemMessage: joinMsg });
    io?.to(`support:${ticketId}`).emit('support:message', joinMsg);
  }

  sendSuccess(res, { message: agentMsg, ticket: updated }, 'Đã gửi phản hồi', 201);
};

// ── Admin: đóng ticket ──────────────────────────────────────────────────────
export const adminCloseTicket = async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw ApiError.notFound('Không tìm thấy ticket');

  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED' } });

  const io = (req as any).app.get('io');
  io?.to(`support:${ticketId}`).emit('support:closed', { ticketId });

  sendSuccess(res, null, 'Đã đóng ticket');
};

// ── Admin: số ticket pending ────────────────────────────────────────────────
export const adminTicketStats = async (_req: Request, res: Response) => {
  const [pending, withHuman, total] = await Promise.all([
    prisma.supportTicket.count({ where: { status: 'PENDING_HUMAN' } }),
    prisma.supportTicket.count({ where: { status: 'WITH_HUMAN' } }),
    prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
  ]);
  sendSuccess(res, { pending, withHuman, total });
};
