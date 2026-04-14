export interface User {
  id: string;
  username: string;
  roomId: number;
  isHost: boolean;
  canControl?: boolean;
}

export type SyncCommand = {
  authorityId: string;
  seq: number;
  sentAt: number;
  type: string;
  payload?: any;
};

export type PlayerSnapshot = {
  authorityId: string;
  seq: number;
  sentAt: number;
  url: string;
  isPlaying: boolean;
  position: number;
  songInfo?: any;
  playMode?: string;
};

export type VoteType = 'SKIP_SONG' | 'CHANGE_HOST' | 'KICK_USER';

export interface Vote {
  id: string;
  roomId: number;
  type: VoteType;
  initiatorId: string;
  targetId?: string;
  voters: Set<string>;
  rejecters: Set<string>;
  createdAt: number;
}

export type RoomMode = 'dictator' | 'democracy';
