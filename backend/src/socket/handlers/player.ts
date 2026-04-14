import { Server, Socket } from 'socket.io';
import { roomStore } from '../../services/RoomStore';
import { SyncCommand, PlayerSnapshot } from '../../types';

export const registerPlayerHandlers = (io: Server, socket: Socket) => {
  socket.on('add-song', ({ roomId, song }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || user.roomId !== numRoomId) return;
    
    const pl = roomStore.getPlaylist(numRoomId);
    
    const trackId = song.songmid || song.hash || song.id;
    const existingIndex = pl.findIndex((s: any) => (s.songmid || s.hash || s.id) === trackId);
    if (existingIndex !== -1) {
      socket.emit('add-song-error', { message: JSON.stringify({ key: 'addSongErrorDuplicate' }) });
      return;
    }

    song.requesterId = user.id;
    song.requesterName = user.username;
    pl.push(song);
    roomStore.setPlaylist(numRoomId, pl);
    
    io.to(String(numRoomId)).emit('room-playlist', pl);
    io.to(String(numRoomId)).emit('chat-message', {
      sender: 'System',
      message: JSON.stringify({ key: 'songAdded', params: { user: user.username, song: song.name } }),
      isSystem: true,
    });
  });

  socket.on('remove-song', ({ roomId, index }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || (!user.isHost && !user.canControl) || user.roomId !== numRoomId) return;
    
    const pl = roomStore.getPlaylist(numRoomId);
    if (index >= 0 && index < pl.length) {
      pl.splice(index, 1);
      roomStore.setPlaylist(numRoomId, pl);
      io.to(String(numRoomId)).emit('room-playlist', pl);
    }
  });

  socket.on('clear-playlist', ({ roomId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || (!user.isHost && !user.canControl) || user.roomId !== numRoomId) return;
    
    roomStore.setPlaylist(numRoomId, []);
    io.to(String(numRoomId)).emit('room-playlist', []);
  });

  socket.on('sync-command', ({ roomId, command }: { roomId: number; command: SyncCommand }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || user.roomId !== numRoomId) return;
    if (!command || typeof command.seq !== 'number' || typeof command.sentAt !== 'number' || typeof command.type !== 'string') return;

    let hasPermission = user.isHost || user.canControl;
    if (!hasPermission) return;

    if (command.type === 'SET_TRACK' && command.payload?.songInfo) {
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'songSkipped', params: { user: user.username, song: command.payload.songInfo.name } }),
        isSystem: true,
      });
    } else if (command.type === 'CHANGE_MODE') {
      const modeNames: Record<string, string> = {
        'list-loop': '列表循环',
        'single-loop': '单曲循环',
        'random': '随机播放'
      };
      const modeName = modeNames[command.payload?.mode] || command.payload?.mode;
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'modeChanged', params: { user: user.username, mode: modeName } }),
        isSystem: true,
      });
    }

    const forwarded: SyncCommand = { ...command, authorityId: socket.id };
    socket.to(String(numRoomId)).emit('sync-command', forwarded);
  });

  socket.on('request-state', ({ roomId }: { roomId: number }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || user.roomId !== numRoomId) return;

    const host = roomStore.getHost(numRoomId);
    if (!host) return;
    io.to(host.id).emit('request-state', { roomId: numRoomId, fromUserId: socket.id });
  });

  socket.on('state-response', ({ roomId, toUserId, snapshot }: { roomId: number; toUserId: string; snapshot: PlayerSnapshot }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || !user.isHost || user.roomId !== numRoomId) return;

    const targetUser = roomStore.getUser(toUserId);
    if (!targetUser || targetUser.roomId !== numRoomId) return;
    if (!snapshot || typeof snapshot.seq !== 'number' || typeof snapshot.sentAt !== 'number' || typeof snapshot.url !== 'string') return;

    const forwarded: PlayerSnapshot = { ...snapshot, authorityId: socket.id };
    io.to(toUserId).emit('state-response', { roomId: numRoomId, snapshot: forwarded });
  });

  socket.on('ping-time', (clientTime: number) => {
    socket.emit('pong-time', { clientTime, serverTime: Date.now() });
  });
};