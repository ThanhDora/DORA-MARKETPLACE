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

  const messageRoomId = roomId || `dm-${[userId, receiverId].sort().join('-')}`;

  const message = await prisma.message.create({
    data: {
      senderId: userId,
      receiverId,
      content,
      roomId: messageRoomId,
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
    },
  });

  sendSuccess(res, message, 'Gửi tin nhắn thành công', 201);
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
