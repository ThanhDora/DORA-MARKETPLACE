import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { processAIChat } from '../services/ai.service.js';

export const getChatRooms = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const [aiSessions, conversations] = await Promise.all([
    prisma.aIChatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    }),
    prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      distinct: ['roomId'],
      orderBy: [{ roomId: 'asc' }, { createdAt: 'desc' }],
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  sendSuccess(res, { aiSessions, conversations });
};

export const getMessages = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { roomId } = req.params;
  const { page = '1', limit = '50' } = req.query;

  const [isParticipant, isAISession] = await Promise.all([
    prisma.message.findFirst({
      where: {
        roomId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    }),
    prisma.aIChatSession.findFirst({
      where: { id: isNaN(Number(roomId)) ? undefined : Number(roomId), userId },
    }),
  ]);

  if (!isParticipant && !isAISession) {
    throw ApiError.forbidden('Bạn không có quyền truy cập phòng chat này');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { roomId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.message.count({ where: { roomId } }),
  ]);

  await prisma.message.updateMany({
    where: { roomId, receiverId: userId, isRead: false },
    data: { isRead: true },
  });

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, messages, { page: Number(page), limit: Number(limit), total });
};

export const sendMessage = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { receiverId, content, roomId } = req.body;

  if (!content?.trim()) throw ApiError.badRequest('Nội dung không được trống');
  if (!receiverId && !roomId) throw ApiError.badRequest('Thiếu receiverId hoặc roomId');

  const messageRoomId = roomId || `dm-${[userId, receiverId].sort().join('-')}`;

  const message = await prisma.message.create({
    data: {
      senderId: userId,
      receiverId: receiverId ?? null,
      content: content.trim(),
      roomId: messageRoomId,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, avatar: true } },
      receiver: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  // Phát realtime cho cả room và thông báo đến người nhận
  const io = (req as any).app.get('io');
  io?.to(`room:${messageRoomId}`).emit('new_message', message);
  if (receiverId) {
    io?.to(`user:${receiverId}`).emit('notification', {
      type: 'message',
      from: userId,
      roomId: messageRoomId,
      content: content.trim(),
    });
  }

  sendSuccess(res, message, 'Gửi tin nhắn thành công', 201);
};

// Seller: lấy danh sách hội thoại DM với buyers
export const getSellerInbox = async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;

  // Lấy các roomId DM mà seller tham gia
  const rooms = await prisma.message.findMany({
    where: {
      roomId: { startsWith: 'dm-' },
      OR: [{ senderId: sellerId }, { receiverId: sellerId }],
    },
    distinct: ['roomId'],
    orderBy: { createdAt: 'desc' },
    select: { roomId: true },
  });

  if (!rooms.length) {
    sendSuccess(res, []);
    return;
  }

  // Với mỗi room, lấy tin nhắn cuối + thông tin người còn lại
  const inboxItems = await Promise.all(
    rooms.map(async ({ roomId }) => {
      const [lastMsg, unread] = await Promise.all([
        prisma.message.findFirst({
          where: { roomId },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
            receiver: { select: { id: true, name: true, avatar: true } },
          },
        }),
        prisma.message.count({
          where: { roomId, receiverId: sellerId, isRead: false },
        }),
      ]);

      if (!lastMsg) return null;

      const other =
        lastMsg.senderId === sellerId ? lastMsg.receiver : lastMsg.sender;

      return { roomId, lastMessage: lastMsg, otherUser: other, unreadCount: unread };
    })
  );

  const filtered = inboxItems.filter(Boolean);
  sendSuccess(res, filtered);
};

export const chatWithAI = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { sessionId, message, context } = req.body;

  const result = await processAIChat(userId, message, sessionId, context);

  sendSuccess(res, result);
};

export const getAISessions = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const sessions = await prisma.aIChatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  sendSuccess(res, sessions);
};

export const getAIChatHistory = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const sessionId = Number(req.params.sessionId);
  const { page = '1', limit = '50' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const session = await prisma.aIChatSession.findFirst({
    where: { id: sessionId, userId },
    include: { _count: { select: { messages: true } } },
  });

  if (!session) throw ApiError.notFound('Không tìm thấy phiên chat');

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { sessionId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.count({ where: { sessionId } }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, messages, { page: Number(page), limit: Number(limit), total });
};
