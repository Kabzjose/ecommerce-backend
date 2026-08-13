import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { verifyAccessToken } from './token.js';
import { logger } from './logger.js';
import { prisma } from '../config/db.js';

let io: SocketIOServer;

export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // Runs once per connection attempt, before any events are handled —
  // direct equivalent of requireAuth middleware but for the socket lifecycle.
  // Verify the JWT once when the connection opens; every subsequent event on
  // that socket can trust socket.data without re-verifying.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Missing authentication token'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.data.userId, role: socket.data.role }, 'Socket connected');

    // ─── Customer (or admin) subscribes to watch a specific booking ──────────
    socket.on('booking:subscribe', async (bookingId: string) => {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) {
        return void socket.emit('error', { message: 'Booking not found' });
      }

      const isOwner = booking.customerId === socket.data.userId;
      const isAssignedRider = booking.riderId === socket.data.userId;
      const isAdmin = socket.data.role === 'ADMIN';

      if (!isOwner && !isAssignedRider && !isAdmin) {
        return void socket.emit('error', { message: 'Not authorized to track this booking' });
      }

      socket.join(`booking:${bookingId}`);

      if (booking.riderLat && booking.riderLng) {
        socket.emit('location:changed', {
          bookingId,
          lat: booking.riderLat,
          lng: booking.riderLng,
          updatedAt: booking.riderLocatedAt,
        });
      }
    });

    // ─── Rider pushes their GPS position ────────────────────────────────────
    socket.on('location:update', async (data: { bookingId: string; lat: number; lng: number }) => {
      if (socket.data.role !== 'RIDER') {
        return void socket.emit('error', { message: 'Only riders can send location updates' });
      }

      const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
      if (!booking) {
        return void socket.emit('error', { message: 'Booking not found' });
      }
      if (booking.riderId !== socket.data.userId) {
        return void socket.emit('error', { message: 'You are not assigned to this booking' });
      }
      if (booking.status !== 'PICKED_UP' && booking.status !== 'IN_TRANSIT') {
        return void socket.emit('error', { message: 'Tracking is only active during active delivery' });
      }
      if (
        typeof data.lat !== 'number' ||
        typeof data.lng !== 'number' ||
        data.lat < -90 || data.lat > 90 ||
        data.lng < -180 || data.lng > 180
      ) {
        return void socket.emit('error', { message: 'Invalid coordinates' });
      }

      const updatedAt = new Date();
      await prisma.booking.update({
        where: { id: data.bookingId },
        data: { riderLat: data.lat, riderLng: data.lng, riderLocatedAt: updatedAt },
      });

      socket.to(`booking:${data.bookingId}`).emit('location:changed', {
        bookingId: data.bookingId,
        lat: data.lat,
        lng: data.lng,
        updatedAt,
      });
    });

    socket.on('booking:unsubscribe', (bookingId: string) => {
      socket.leave(`booking:${bookingId}`);
    });

    socket.on('disconnect', () => {
      logger.info({ userId: socket.data.userId }, 'Socket disconnected');
    });
  });

  return io;
}

// Used by any module that needs to emit events (e.g. after a status update via REST)
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized — call initSocketServer first');
  return io;
}
