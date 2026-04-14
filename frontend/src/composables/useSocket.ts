import { io } from 'socket.io-client';
import { i18n } from '../i18n';
import { 
  backendUrl, socket, token, username, roomId, isJoined, 
  serverTimeOffset, users, roomPlaylist, roomMode, modeToast,
  isHost, hostUserId, lastAppliedSeq, chatMessages, activeVote,
} from '../store/state';
import { useAuth } from './useAuth';
import { usePlayer } from './usePlayer';

let pingInterval: number | null = null;
let modeToastTimer: number | null = null;

const getTranslatedMessage = (rawMsg: string) => {
  const t = i18n.global.t;
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed.key) {
      const prefix = parsed.key.includes('Error') ? 'app.errors.' : 'app.systemChat.';
      return t(prefix + parsed.key, parsed.params || {});
    }
  } catch (e) {}
  return rawMsg;
};

export function useSocket() {
  const { handleLogout } = useAuth();
  const { applySyncCommand, buildSnapshot, applySnapshot, playNextSong } = usePlayer();
  const t = i18n.global.t;

  const connectSocket = () => {
    if (!username.value || !roomId.value || !token.value) return;
    
    socket.value = io(backendUrl, { auth: { token: token.value } });
    
    socket.value.on('connect', () => {
      socket.value?.emit('join-room', { roomId: Number(roomId.value), username: username.value });
      isJoined.value = true;
      
      socket.value?.emit('ping-time', Date.now());
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = window.setInterval(() => {
        socket.value?.emit('ping-time', Date.now());
      }, 5000);
    });
    
    socket.value.on('join-error', (data) => {
      alert(getTranslatedMessage(data.message));
      isJoined.value = false;
      if (pingInterval) clearInterval(pingInterval);
      if (socket.value) socket.value.disconnect();
    });
    
    socket.value.on('pong-time', ({ clientTime, serverTime }) => {
      const now = Date.now();
      const rtt = now - clientTime;
      const latency = rtt / 2;
      const estimatedServerTime = serverTime + latency;
      serverTimeOffset.value = estimatedServerTime - now;
    });

    socket.value.on('room-info', (data) => {
      users.value = data.users;
      if (data.playlist) roomPlaylist.value = data.playlist;
      if (data.roomMode && data.roomMode !== roomMode.value) {
        roomMode.value = data.roomMode;
        modeToast.value = data.roomMode === 'dictator' ? t('app.switchedToDictator') : t('app.switchedToDemocracy');
        if (modeToastTimer) clearTimeout(modeToastTimer);
        modeToastTimer = window.setTimeout(() => { modeToast.value = ''; }, 3000);
      }
      const me = users.value.find(u => u.id === socket.value?.id);
      if (me) isHost.value = me.isHost;

      const host = users.value.find(u => u.isHost);
      const nextHostId = host?.id ?? null;
      const hostChanged = hostUserId.value !== nextHostId;
      hostUserId.value = nextHostId;

      if (!isHost.value && (hostChanged || lastAppliedSeq.value === 0)) {
        lastAppliedSeq.value = 0;
        socket.value?.emit('request-state', { roomId: Number(roomId.value) });
      }
    });

    socket.value.on('room-playlist', (data) => {
      roomPlaylist.value = data;
    });

    socket.value.on('chat-message', (data) => {
      const translatedMessage = data.isSystem ? getTranslatedMessage(data.message) : data.message;
      chatMessages.value.push({ ...data, message: translatedMessage });
      setTimeout(() => {
        const el = document.getElementById('chat-scroll');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    });

    socket.value.on('sync-command', (command) => {
      applySyncCommand(command);
    });

    socket.value.on('request-state', ({ roomId: requestedRoomId, fromUserId }) => {
      if (!isHost.value) return;
      if (Number(roomId.value) !== Number(requestedRoomId)) return;
      const snapshot = buildSnapshot();
      if (!snapshot) return;
      socket.value?.emit('state-response', { roomId: Number(roomId.value), toUserId: fromUserId, snapshot });
    });

    socket.value.on('vote-error', (data) => {
      alert(getTranslatedMessage(data.message));
    });

    socket.value.on('add-song-error', (data) => {
      alert(getTranslatedMessage(data.message));
    });

    socket.value.on('state-response', ({ roomId: responseRoomId, snapshot }) => {
      if (isHost.value) return;
      if (Number(roomId.value) !== Number(responseRoomId)) return;
      applySnapshot(snapshot);
    });
    
    socket.value.on('vote-started', (vote) => {
      activeVote.value = { ...vote, hasVoted: vote.initiatorName === username.value };
    });
    
    socket.value.on('vote-progress', (data) => {
      if (activeVote.value && activeVote.value.id === data.id) {
        activeVote.value.yesCount = data.yesCount;
        activeVote.value.noCount = data.noCount;
        activeVote.value.required = data.required;
      }
    });

    socket.value.on('vote-ended', (data) => {
      if (activeVote.value && activeVote.value.id === data.id) {
        activeVote.value.result = data.result;
        setTimeout(() => {
          if (activeVote.value && activeVote.value.id === data.id) {
            activeVote.value = null;
          }
        }, 3000);
      }
    });

    socket.value.on('execute-skip-song', () => {
      if (isHost.value) {
        playNextSong(false);
      }
    });

    socket.value.on('kicked', () => {
      alert(t('app.kickedOut'));
      handleLogout();
    });
  };

  return {
    connectSocket
  };
}