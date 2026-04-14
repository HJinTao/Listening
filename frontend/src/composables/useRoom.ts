import { 
  socket, roomId, isHost, roomMode,
  chatInput, activeVote, isStandalone, activeTab, hasControl 
} from '../store/state';

export function useRoom() {
  const startStandaloneMode = () => {
    isStandalone.value = true;
    roomId.value = '';
    isHost.value = true;
    activeTab.value = 'search';
  };

  const passHost = (targetUserId: string) => {
    if (isHost.value && socket.value) {
      socket.value.emit('pass-host', { roomId: Number(roomId.value), targetUserId });
    }
  };

  const grantControl = (targetUserId: string) => {
    if (isHost.value && socket.value) {
      socket.value.emit('grant-control', { roomId: Number(roomId.value), targetUserId });
    }
  };

  const revokeControl = (targetUserId: string) => {
    if (isHost.value && socket.value) {
      socket.value.emit('revoke-control', { roomId: Number(roomId.value), targetUserId });
    }
  };

  const changeRoomMode = (mode: 'dictator' | 'democracy') => {
    if (isHost.value && socket.value) {
      socket.value.emit('change-room-mode', { roomId: Number(roomId.value), mode });
    }
  };

  const initiateVote = (type: 'SKIP_SONG' | 'CHANGE_HOST' | 'KICK_USER', targetId?: string) => {
    if (socket.value && roomMode.value === 'democracy') {
      socket.value.emit('initiate-vote', { roomId: Number(roomId.value), type, targetId });
    }
  };

  const kickUser = (targetUserId: string) => {
    if (socket.value && hasControl.value) {
      socket.value.emit('kick-user', { roomId: Number(roomId.value), targetUserId });
    }
  };

  const voteYes = () => {
    if (socket.value && activeVote.value) {
      socket.value.emit('vote', { voteId: activeVote.value.id, isYes: true });
      activeVote.value.hasVoted = true;
    }
  };

  const voteNo = () => {
    if (socket.value && activeVote.value) {
      socket.value.emit('vote', { voteId: activeVote.value.id, isYes: false });
      activeVote.value.hasVoted = true;
    }
  };

  const sendChat = () => {
    if (chatInput.value.trim() && socket.value) {
      socket.value.emit('chat-message', { roomId: Number(roomId.value), message: chatInput.value });
      chatInput.value = '';
    }
  };

  return {
    startStandaloneMode,
    passHost,
    grantControl,
    revokeControl,
    changeRoomMode,
    initiateVote,
    kickUser,
    voteYes,
    voteNo,
    sendChat
  };
}