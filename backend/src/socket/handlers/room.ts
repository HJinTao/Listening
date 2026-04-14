import { Server, Socket } from 'socket.io';
import { roomStore } from '../../services/RoomStore';
import { checkVote } from './vote';

export const registerRoomHandlers = (io: Server, socket: Socket) => {
  socket.on('join-room', ({ roomId }) => {
    const numRoomId = Number(roomId);
    if (isNaN(numRoomId)) return;

    const username = (socket as any).user.username;

    // Check if room exists to assign host
    const existingUsers = roomStore.getUsersInRoom(numRoomId);

    // Reject duplicate join
    if (existingUsers.some(u => u.username === username)) {
      socket.emit('join-error', { message: JSON.stringify({ key: 'joinErrorDuplicate' }) });
      return;
    }

    socket.join(String(numRoomId));
    
    const isHost = existingUsers.length === 0;
    const user = { id: socket.id, username, roomId: numRoomId, isHost };
    roomStore.addUser(socket.id, user);

    // Broadcast user joined
    io.to(String(numRoomId)).emit('chat-message', {
      sender: 'System',
      message: JSON.stringify({ key: 'userJoined', params: { user: username } }),
      isSystem: true,
    });

    // Send room info to everyone
    io.to(String(numRoomId)).emit('room-info', {
      users: roomStore.getUsersInRoom(numRoomId),
      playlist: roomStore.getPlaylist(numRoomId),
      roomMode: roomStore.getMode(numRoomId),
    });
  });

  socket.on('change-room-mode', ({ roomId, mode }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      roomStore.setMode(numRoomId, mode);
      
      // Cancel active votes if switching to dictator
      if (mode === 'dictator') {
        const votes = roomStore.getRoomVotes(numRoomId);
        for (const [vId, _] of votes) {
          roomStore.deleteVote(vId);
          io.to(String(numRoomId)).emit('vote-ended', { id: vId, result: 'failed' });
        }
      }

      io.to(String(numRoomId)).emit('room-info', {
        users: roomStore.getUsersInRoom(numRoomId),
        playlist: roomStore.getPlaylist(numRoomId),
        roomMode: mode,
      });
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'roomModeChanged', params: { user: user.username, mode: mode === 'dictator' ? 'dictator' : 'democracy' } }),
        isSystem: true,
      });
    }
  });

  socket.on('pass-host', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = roomStore.getUser(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        user.isHost = false;
        targetUser.isHost = true;
        targetUser.canControl = true;
        io.to(String(numRoomId)).emit('room-info', {
          users: roomStore.getUsersInRoom(numRoomId),
          playlist: roomStore.getPlaylist(numRoomId),
          roomMode: roomStore.getMode(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: JSON.stringify({ key: 'hostTransferred', params: { user: user.username, target: targetUser.username } }),
          isSystem: true,
        });
      }
    }
  });

  socket.on('grant-control', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = roomStore.getUser(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        targetUser.canControl = true;
        io.to(String(numRoomId)).emit('room-info', {
          users: roomStore.getUsersInRoom(numRoomId),
          playlist: roomStore.getPlaylist(numRoomId),
          roomMode: roomStore.getMode(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: JSON.stringify({ key: 'controlGranted', params: { user: user.username, target: targetUser.username } }),
          isSystem: true,
        });
      }
    }
  });

  socket.on('revoke-control', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = roomStore.getUser(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        targetUser.canControl = false;
        io.to(String(numRoomId)).emit('room-info', {
          users: roomStore.getUsersInRoom(numRoomId),
          playlist: roomStore.getPlaylist(numRoomId),
          roomMode: roomStore.getMode(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: JSON.stringify({ key: 'controlRevoked', params: { user: user.username, target: targetUser.username } }),
          isSystem: true,
        });
      }
    }
  });

  socket.on('kick-user', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || user.roomId !== numRoomId) return;
    if (!user.isHost && !user.canControl) return;

    const targetUser = roomStore.getUser(targetUserId);
    if (targetUser && targetUser.roomId === numRoomId) {
      const targetSocket = io.sockets.sockets.get(targetUserId);
      if (targetSocket) {
        targetSocket.emit('kicked');
        targetSocket.disconnect(true);
      }
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'userKicked', params: { user: user.username, target: targetUser.username } }),
        isSystem: true,
      });
    }
  });

  socket.on('disconnect', () => {
    const user = roomStore.getUser(socket.id);
    if (user) {
      const { roomId, username, isHost } = user;
      roomStore.removeUser(socket.id);
      socket.leave(String(roomId));

      io.to(String(roomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'userLeft', params: { user: username } }),
        isSystem: true,
      });

      const remainingUsers = roomStore.getUsersInRoom(roomId);
      if (remainingUsers.length > 0) {
        if (isHost && remainingUsers[0]) {
          remainingUsers[0].isHost = true;
          io.to(String(roomId)).emit('chat-message', {
            sender: 'System',
            message: JSON.stringify({ key: 'becameHost', params: { user: remainingUsers[0].username } }),
            isSystem: true,
          });
        }

        io.to(String(roomId)).emit('room-info', {
          users: remainingUsers,
          roomMode: roomStore.getMode(roomId),
        });

        // Update active votes
        const votes = roomStore.getRoomVotes(roomId);
        for (const [voteId, vote] of votes) {
          vote.voters.delete(socket.id);
          vote.rejecters.delete(socket.id);
          checkVote(io, voteId);
        }
      } else {
        roomStore.deleteRoom(roomId);
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
};