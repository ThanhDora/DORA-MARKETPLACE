import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt.js';
import { logger } from '../config/logger.js';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
}

export const initializeSocket = (server: HttpServer): Server => {
  const io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`User connected: ${socket.userId}`);

    socket.join(`user:${socket.userId}`);

    socket.on('join_room', async (roomId: string) => {
      // Kiểm tra quyền: user phải là participant của room
      const isDM = roomId.startsWith('dm-');
      if (isDM) {
        const parts = roomId.split('-');
        const userIds = parts.slice(1).map(Number);
        if (!userIds.includes(socket.userId!)) {
          socket.emit('error', { message: 'Unauthorized room access' });
          return;
        }
      } else {
        const isParticipant = await prisma.message.findFirst({
          where: {
            roomId,
            OR: [
              { senderId: socket.userId },
              { receiverId: socket.userId },
            ],
          },
        });
        if (!isParticipant) {
          socket.emit('error', { message: 'Unauthorized room access' });
          return;
        }
      }

      socket.join(`room:${roomId}`);
      logger.info(`User ${socket.userId} joined room: ${roomId}`);
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('send_message', async (data: { roomId: string; content: string; receiverId?: string }) => {
      // Verify socket is in the room
      if (!socket.rooms.has(`room:${data.roomId}`)) {
        socket.emit('error', { message: 'Not in this room' });
        return;
      }

      io.to(`room:${data.roomId}`).emit('new_message', {
        senderId: socket.userId,
        content: data.content,
        createdAt: new Date(),
      });

      if (data.receiverId) {
        io.to(`user:${data.receiverId}`).emit('notification', {
          type: 'message',
          from: socket.userId,
          content: data.content,
        });
      }
    });

    const aiChatCooldowns = new Map<number, number>();

    socket.on('ai_chat', async (data: { message: string; sessionId?: string }) => {
      const now = Date.now();
      const lastCall = aiChatCooldowns.get(socket.userId!) || 0;
      if (now - lastCall < 3000) {
        socket.emit('error', { message: 'Please wait before sending another AI message' });
        return;
      }
      aiChatCooldowns.set(socket.userId!, now);

      socket.emit('ai_typing', { isTyping: true });

      setTimeout(() => {
        socket.emit('ai_response', {
          content: `Echo: ${data.message}`,
          sessionId: data.sessionId,
        });
        socket.emit('ai_typing', { isTyping: false });
      }, 1000);
    });

    socket.on('typing', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('user_typing', {
        userId: socket.userId,
        roomId: data.roomId,
      });
    });

    socket.on('mark_read', (data: { roomId: string }) => {
      socket.to(`room:${data.roomId}`).emit('messages_read', {
        userId: socket.userId,
        roomId: data.roomId,
      });
    });

    // ── Support chat ──────────────────────────────────────────────────────
    // Admin join agent room để nhận new_pending events
    if (socket.userRole === 'ADMIN') {
      socket.join('support:agents');
    }

    socket.on('support:join', async (ticketId: number) => {
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id: ticketId,
          OR: [{ userId: socket.userId }, { agentId: socket.userId }],
        },
      });
      const isAdmin = socket.userRole === 'ADMIN';
      if (!ticket && !isAdmin) {
        socket.emit('error', { message: 'Unauthorized support room' });
        return;
      }
      socket.join(`support:${ticketId}`);
    });

    socket.on('support:leave', (ticketId: number) => {
      socket.leave(`support:${ticketId}`);
    });

    socket.on('support:typing', (data: { ticketId: number; isTyping: boolean }) => {
      socket.to(`support:${data.ticketId}`).emit('support:user_typing', {
        userId: socket.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};
