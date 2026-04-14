import { Server, Socket } from 'socket.io';
import { roomStore } from '../../services/RoomStore';
import { Vote } from '../../types';

export const registerVoteHandlers = (io: Server, socket: Socket) => {
  socket.on('initiate-vote', ({ roomId, type, targetId }) => {
    const numRoomId = Number(roomId);
    const user = roomStore.getUser(socket.id);
    if (!user || user.roomId !== numRoomId) return;

    if (roomStore.getMode(numRoomId) !== 'democracy') {
      socket.emit('vote-error', { message: JSON.stringify({ key: 'voteErrorDemocracyOnly' }) });
      return;
    }

    if (type === 'CHANGE_HOST' && targetId) {
      const targetUser = roomStore.getUser(targetId);
      if (targetUser && targetUser.isHost) {
        return;
      }
    }

    // Cancel any existing active votes in the room
    const votes = roomStore.getRoomVotes(numRoomId);
    for (const [vId, _] of votes) {
      roomStore.deleteVote(vId);
      io.to(String(numRoomId)).emit('vote-ended', { id: vId, result: 'failed' });
    }

    const voteId = `${numRoomId}_${type}_${targetId || ''}_${Date.now()}`;
    const vote: Vote = {
      id: voteId,
      roomId: numRoomId,
      type,
      initiatorId: socket.id,
      targetId,
      voters: new Set([socket.id]),
      rejecters: new Set(),
      createdAt: Date.now()
    };

    roomStore.addVote(voteId, vote);

    let targetName = '';
    if (targetId) {
      targetName = roomStore.getUser(targetId)?.username || '';
    }

    const roomUsers = roomStore.getUsersInRoom(numRoomId);
    const requiredVotes = Math.floor(roomUsers.length / 2) + 1;

    io.to(String(numRoomId)).emit('vote-started', {
      id: voteId,
      type,
      initiatorName: user.username,
      targetName,
      targetId,
      yesCount: 1,
      noCount: 0,
      required: requiredVotes
    });

    checkVote(io, voteId);
  });

  socket.on('vote', ({ voteId, isYes }) => {
    const user = roomStore.getUser(socket.id);
    if (!user) return;

    const vote = roomStore.getVote(voteId);
    if (!vote || vote.roomId !== user.roomId) return;

    if (isYes) {
      vote.voters.add(socket.id);
      vote.rejecters.delete(socket.id);
    } else {
      vote.rejecters.add(socket.id);
      vote.voters.delete(socket.id);
    }
    checkVote(io, voteId);
  });
};

export function checkVote(io: Server, voteId: string) {
  const vote = roomStore.getVote(voteId);
  if (!vote) return;

  const roomUsers = roomStore.getUsersInRoom(vote.roomId);
  const requiredVotes = Math.floor(roomUsers.length / 2) + 1;
  const requiredRejects = Math.ceil(roomUsers.length / 2);

  if (vote.voters.size >= requiredVotes) {
    executeVote(io, vote);
    io.to(String(vote.roomId)).emit('vote-ended', { id: voteId, result: 'passed' });
    roomStore.deleteVote(voteId);
  } else if (vote.rejecters.size >= requiredRejects || (vote.voters.size + vote.rejecters.size === roomUsers.length)) {
    io.to(String(vote.roomId)).emit('vote-ended', { id: voteId, result: 'failed' });
    roomStore.deleteVote(voteId);
  } else {
    io.to(String(vote.roomId)).emit('vote-progress', {
      id: voteId,
      yesCount: vote.voters.size,
      noCount: vote.rejecters.size,
      required: requiredVotes
    });
  }
}

export function executeVote(io: Server, vote: Vote) {
  const numRoomId = vote.roomId;
  if (vote.type === 'SKIP_SONG') {
    io.to(String(numRoomId)).emit('chat-message', {
      sender: 'System',
      message: JSON.stringify({ key: 'votePassedSkip' }),
      isSystem: true,
    });
    io.to(String(numRoomId)).emit('execute-skip-song');
  } else if (vote.type === 'CHANGE_HOST') {
    const newHost = roomStore.getUser(vote.targetId!);
    if (newHost && newHost.roomId === numRoomId) {
      const oldHost = roomStore.getHost(numRoomId);
      if (oldHost) oldHost.isHost = false;
      newHost.isHost = true;
      newHost.canControl = true;

      io.to(String(numRoomId)).emit('room-info', {
        users: roomStore.getUsersInRoom(numRoomId),
        playlist: roomStore.getPlaylist(numRoomId),
        roomMode: roomStore.getMode(numRoomId),
      });
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'votePassedHost', params: { user: newHost.username } }),
        isSystem: true,
      });
    }
  } else if (vote.type === 'KICK_USER') {
    const targetUser = roomStore.getUser(vote.targetId!);
    if (targetUser && targetUser.roomId === numRoomId) {
      const sockets = io.sockets.sockets;
      const targetSocket = sockets.get(vote.targetId!);
      if (targetSocket) {
        targetSocket.emit('kicked');
        targetSocket.disconnect(true);
      }
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: JSON.stringify({ key: 'votePassedKick', params: { user: targetUser.username } }),
        isSystem: true,
      });
    }
  }
}