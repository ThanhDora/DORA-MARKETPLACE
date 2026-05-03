import type { Server as SocketIOServer } from 'socket.io';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface CreateNotificationInput {
  userId: number;
  title: string;
  content: string;
  type?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createAndEmit(
  io: SocketIOServer | undefined,
  input: CreateNotificationInput,
) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      content: input.content,
      type: input.type || 'GENERAL',
      metadata: input.metadata || {},
    },
  });

  if (io) {
    io.to(`user:${input.userId}`).emit('notification:new', {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
    });
  }

  return notification;
}

export async function createAndEmitBulk(
  io: SocketIOServer | undefined,
  userIds: number[],
  input: Omit<CreateNotificationInput, 'userId'>,
) {
  if (userIds.length === 0) return 0;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: input.title,
      content: input.content,
      type: input.type || 'GENERAL',
      metadata: input.metadata || {},
    })),
  });

  if (io) {
    const payload = {
      title: input.title,
      content: input.content,
      type: input.type || 'GENERAL',
    };
    userIds.forEach((userId) => {
      io.to(`user:${userId}`).emit('notification:new', payload);
    });
  }

  return userIds.length;
}
