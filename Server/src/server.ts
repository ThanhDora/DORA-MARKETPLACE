import { createServer } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './lib/prisma.js';
import { getRedis } from './lib/redis.js';
import { initializeSocket } from './lib/socket.js';
import { startOrderCleanupJob } from './jobs/orderCleanup.job.js';

const PORT = parseInt(env.PORT || '3000');
const server = createServer(app);

const redis = getRedis();
if (redis) {
  logger.info('Redis initialized');
}

const io = initializeSocket(server);
app.set('io', io);

startOrderCleanupJob(io);

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${PORT} is in use. Attempting to free it...`);
        import('child_process').then(({ execFile }) => {
          execFile('lsof', ['-ti', `:${PORT}`], (lsofErr, stdout) => {
            if (lsofErr || !stdout.trim()) {
              logger.error(`Could not free port ${PORT}`);
              process.exit(1);
              return;
            }
            const pids = stdout.trim().split('\n').filter(Boolean);
            execFile('kill', ['-9', ...pids], () => {
              setTimeout(() => {
                server.close(() => {
                  server.listen(PORT, () => {
                    logger.info(`Server running on port ${PORT} (after cleanup)`);
                  });
                });
              }, 1000);
            });
          });
        });
      } else {
        logger.error(`Server error: ${err.message}`);
      }
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  const forceShutdown = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Database disconnected');

      if (redis) {
        redis.quit();
        logger.info('Redis disconnected');
      }

      clearTimeout(forceShutdown);
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      clearTimeout(forceShutdown);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', async (error: unknown) => {
  const err = error as NodeJS.ErrnoException;
  if (err.code === 'EADDRINUSE') {
    logger.warn(`Port ${PORT} is in use. Kill the process: lsof -ti :${PORT} | xargs kill -9`);
    process.exit(0);
  }
  logger.error(`Uncaught Exception: ${(error as Error).message}`);
  try {
    await prisma.$disconnect();
    if (redis) redis.quit();
  } catch {}
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

startServer();

export default server;
