import { createServer } from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './config/db.js';
import { initSocketServer } from './lib/socket.js';

// Must create the HTTP server explicitly so Socket.io can attach to the same
// port as Express — Socket.io needs access to the upgrade handshake that
// app.listen() would otherwise manage internally and invisibly.
const httpServer = createServer(app);
initSocketServer(httpServer);

const server = httpServer.listen(env.PORT, () => {
  logger.info(`🚀 Server (HTTP + WebSocket) running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

// Closes the HTTP server and DB connection cleanly on SIGINT/SIGTERM
async function shutdown() {
  logger.info('Shutting down gracefully...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
