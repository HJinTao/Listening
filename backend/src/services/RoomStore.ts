import { User, RoomMode, Vote, VoteType } from '../types';

class RoomStore {
  public users = new Map<string, User>();
  public roomPlaylists = new Map<number, any[]>();
  public roomModes = new Map<number, RoomMode>();
  public activeVotes = new Map<string, Vote>();

  // User Operations
  getUser(socketId: string): User | undefined {
    return this.users.get(socketId);
  }

  addUser(socketId: string, user: User) {
    this.users.set(socketId, user);
  }

  removeUser(socketId: string) {
    this.users.delete(socketId);
  }

  getUsersInRoom(roomId: number): User[] {
    return Array.from(this.users.values()).filter(u => u.roomId === roomId);
  }

  getHost(roomId: number): User | undefined {
    return this.getUsersInRoom(roomId).find(u => u.isHost);
  }

  // Playlist Operations
  getPlaylist(roomId: number): any[] {
    if (!this.roomPlaylists.has(roomId)) {
      this.roomPlaylists.set(roomId, []);
    }
    return this.roomPlaylists.get(roomId) || [];
  }

  setPlaylist(roomId: number, playlist: any[]) {
    this.roomPlaylists.set(roomId, playlist);
  }

  // Room Mode Operations
  getMode(roomId: number): RoomMode {
    if (!this.roomModes.has(roomId)) {
      this.roomModes.set(roomId, 'dictator');
    }
    return this.roomModes.get(roomId) || 'dictator';
  }

  setMode(roomId: number, mode: RoomMode) {
    this.roomModes.set(roomId, mode);
  }

  deleteRoom(roomId: number) {
    this.roomPlaylists.delete(roomId);
    this.roomModes.delete(roomId);
    this.clearRoomVotes(roomId);
  }

  // Vote Operations
  getVote(voteId: string): Vote | undefined {
    return this.activeVotes.get(voteId);
  }

  addVote(voteId: string, vote: Vote) {
    this.activeVotes.set(voteId, vote);
  }

  deleteVote(voteId: string) {
    this.activeVotes.delete(voteId);
  }

  getRoomVotes(roomId: number): [string, Vote][] {
    return Array.from(this.activeVotes.entries()).filter(([_, v]) => v.roomId === roomId);
  }

  clearRoomVotes(roomId: number) {
    for (const [vId, v] of this.activeVotes.entries()) {
      if (v.roomId === roomId) {
        this.activeVotes.delete(vId);
      }
    }
  }
}

export const roomStore = new RoomStore();