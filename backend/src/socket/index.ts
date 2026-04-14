import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { registerRoomHandlers } from './handlers/room';
import { registerChatHandlers } from './handlers/chat';
import { registerPlayerHandlers } from './handlers/player';
import { registerVoteHandlers } from './handlers/vote';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_listening_key_123';

export const setupSocket = (io: Server) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerPlayerHandlers(io, socket);
    registerVoteHandlers(io, socket);
  });
};