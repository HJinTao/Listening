import { Server, Socket } from 'socket.io';
import { roomStore } from '../../services/RoomStore';

export const registerChatHandlers = (io: Server, socket: Socket) => {
  socket.on('chat-message', ({ roomId, message }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (user && user.roomId === numRoomId) {
      io.to(String(numRoomId)).emit('chat-message', {
        sender: user.username,
        message,
        isSystem: false,
      });
    }
  });
};