<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { io, Socket } from 'socket.io-client';
import { LxEngine } from './utils/lx-engine';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

const toggleLanguage = () => {
  locale.value = locale.value === 'en' ? 'zh' : 'en';
  localStorage.setItem('locale', locale.value);
};

const backendUrl = import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3000';
const socket = ref<Socket | null>(null);

const serverTimeOffset = ref(0);
const getSyncedTime = () => Date.now() + serverTimeOffset.value;
let pingInterval: number | null = null;

const username = ref(localStorage.getItem('username') || '');
const password = ref('');
const roomId = ref<number | ''>('');
const isJoined = ref(false);
const isStandalone = ref(false);
const isLoggedIn = ref(!!localStorage.getItem('token'));
const isLoginMode = ref(true);
const token = ref(localStorage.getItem('token') || '');
const rememberPassword = ref(localStorage.getItem('rememberPassword') === 'true');

if (rememberPassword.value) {
  username.value = localStorage.getItem('saved_username') || '';
  password.value = localStorage.getItem('saved_password') || '';
} else if (!isLoggedIn.value) {
  username.value = '';
  password.value = '';
}

const users = ref<any[]>([]);
const isHost = ref(false);
const roomMode = ref<'dictator'|'democracy'>('dictator');

const hasControl = computed(() => {
  if (isStandalone.value) return true;
  return isHost.value || !!(users.value.find(u => u.id === socket.value?.id)?.canControl);
});

// Atomic Permissions
type Action = 'PLAY_PAUSE' | 'SEEK' | 'SKIP_SONG' | 'ADD_SONG' | 'CHANGE_MODE' | 'KICK_USER' | 'CHANGE_HOST';

const hasPermission = (action: Action): boolean => {
  if (isStandalone.value) return true;
  if (isHost.value) return true;

  if (roomMode.value === 'dictator') {
    if (action === 'ADD_SONG') return true; // Everyone can add
    if (action === 'PLAY_PAUSE' || action === 'SEEK' || action === 'SKIP_SONG') return hasControl.value;
    return false; // KICK, CHANGE_MODE, CHANGE_HOST are host only
  } else if (roomMode.value === 'democracy') {
    if (action === 'ADD_SONG') return true; // Everyone can add
    if (action === 'PLAY_PAUSE' || action === 'SEEK') return hasControl.value;
    if (action === 'SKIP_SONG' || action === 'KICK_USER' || action === 'CHANGE_HOST') return true; // Everyone can initiate vote
    return false; // CHANGE_MODE is host only
  }
  return false;
};

const canSeek = computed(() => hasPermission('SEEK'));

const chatMessages = ref<any[]>([]);
const chatInput = ref('');
const activeVote = ref<any>(null);
const modeToast = ref<string>('');
let modeToastTimer: number | null = null;

const lxEngine = ref<LxEngine | null>(null);
const scriptLoaded = ref(false);

const searchKeyword = ref('');
const searchSource = ref('kw');
const searchResults = ref<any[]>([]);
const isSearching = ref(false);
const searchPage = ref(1);
const searchHasMore = ref(true);

const activeTab = ref('room');
const playlist = ref<any[]>([]);
const roomPlaylist = ref<any[]>([]);

const playMode = ref<'list-loop' | 'single-loop' | 'random'>('list-loop');
const currentContext = ref<'search' | 'playlist' | 'room'>('search');
const volume = ref(1);
const duration = ref(0);

const fetchPlaylist = async () => {
  if (!isLoggedIn.value) return;
  try {
    const resp = await axios.get(`${backendUrl}/api/playlist`);
    playlist.value = resp.data.list;
  } catch (error) {
    console.error('Failed to fetch playlist:', error);
  }
};

const isInPlaylist = (song: any) => {
  const trackId = song.songmid || song.hash || song.id;
  return playlist.value.some(s => (s.songmid || s.hash || s.id) === trackId);
};

const togglePlaylist = async (song: any) => {
  const trackId = song.songmid || song.hash || song.id;
  const inPlaylist = isInPlaylist(song);
  try {
    if (inPlaylist) {
      await axios.delete(`${backendUrl}/api/playlist/${trackId}`);
      playlist.value = playlist.value.filter(s => (s.songmid || s.hash || s.id) !== trackId);
    } else {
      await axios.post(`${backendUrl}/api/playlist`, { song });
      playlist.value.unshift(song);
    }
  } catch (error) {
    console.error('Failed to toggle playlist:', error);
  }
};

const songQuality = ref('128k');
const isLoadingUrl = ref(false);
const isChangingSong = ref(false);

const audioRef = ref<HTMLAudioElement | null>(null);
const currentUrl = ref('');
const isPlaying = ref(false);
const currentTime = ref(0);
const currentSong = ref<any>(null);

const hostUserId = ref<string | null>(null);
const lastAppliedSeq = ref(0);
const pendingAfterLoad = ref<null | { targetTime: number; shouldPlay: boolean }>(null);
const desiredPlaybackRate = ref(1);

let hostHeartbeatTimer: number | null = null;

// Lyric State
const lyrics = ref<{ time: number, text: string }[]>([]);
const currentLyricIndex = ref(-1);
const lyricScrollRef = ref<HTMLElement | null>(null);

const fetchLyrics = async (song: any) => {
  lyrics.value = [{ time: 0, text: t('app.loadingLyrics') }];
  currentLyricIndex.value = -1;
  try {
    const resp = await axios.get(`${backendUrl}/api/lyric`, {
      params: { songmid: song.songmid, source: song.source, hash: song.hash }
    });
    if (resp.data.lyric) {
      parseLrc(resp.data.lyric);
    } else {
      lyrics.value = [{ time: 0, text: t('app.noLyrics') }];
    }
  } catch (error) {
    console.error('Failed to fetch lyrics:', error);
    lyrics.value = [{ time: 0, text: t('app.fetchLyricsFailed') }];
  }
};

const parseLrc = (lrc: string) => {
  const lines = lrc.split('\n');
  const result: { time: number, text: string }[] = [];
  // Support [00:00.00], [00:00.000], [00:00.0], [00:00]
  const timeExp = /\[(\d{2,}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Decode HTML entities if any
    line = line.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
    
    const matches = Array.from(line.matchAll(timeExp));
    if (matches.length > 0) {
      const text = line.replace(timeExp, '').trim();
      for (const match of matches) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const msStr = match[3] || '0';
        const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10) / 1000;
        const time = min * 60 + sec + ms;
        result.push({ time, text });
      }
    }
  }
  lyrics.value = result.sort((a, b) => a.time - b.time);
};

const updateLyricIndex = (currentTime: number) => {
  if (lyrics.value.length === 0) return;
  
  let index = -1;
  for (let i = 0; i < lyrics.value.length; i++) {
    if (currentTime >= lyrics.value[i].time) {
      index = i;
    } else {
      break;
    }
  }
  
  if (index !== currentLyricIndex.value) {
    currentLyricIndex.value = index;
    // Auto scroll to active lyric
    if (lyricScrollRef.value && index !== -1) {
      const activeEl = lyricScrollRef.value.children[index] as HTMLElement;
      if (activeEl) {
        lyricScrollRef.value.scrollTo({
          top: activeEl.offsetTop - lyricScrollRef.value.offsetHeight / 2 + activeEl.offsetHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }
};

onMounted(async () => {
  try {
    const resp = await axios.get(`${backendUrl}/api/script`);
    lxEngine.value = new LxEngine(backendUrl);
    const success = lxEngine.value.loadScript(resp.data);
    if (success) {
      scriptLoaded.value = true;
    }
  } catch (error) {
    console.error('Failed to auto-load script:', error);
  }
});

const handleAuth = async () => {
  if (!username.value || !password.value) return alert('Username and password required');
  try {
    const endpoint = isLoginMode.value ? '/api/auth/login' : '/api/auth/register';
    const resp = await axios.post(`${backendUrl}${endpoint}`, {
      username: username.value,
      password: password.value
    });
    token.value = resp.data.token;
    username.value = resp.data.user.username;
    localStorage.setItem('token', token.value);
    localStorage.setItem('username', username.value);
    
    if (isLoginMode.value) {
      if (rememberPassword.value) {
        localStorage.setItem('rememberPassword', 'true');
        localStorage.setItem('saved_username', username.value);
        localStorage.setItem('saved_password', password.value);
      } else {
        localStorage.setItem('rememberPassword', 'false');
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
      }
    }

    isLoggedIn.value = true;
  } catch (error: any) {
    alert(error.response?.data?.error || 'Authentication failed');
  }
};

const handleLogout = () => {
  token.value = '';
  username.value = '';
  password.value = '';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  isLoggedIn.value = false;
  isJoined.value = false;
  isStandalone.value = false;
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (socket.value) socket.value.disconnect();
};

const startStandaloneMode = () => {
  isStandalone.value = true;
  roomId.value = '';
  isHost.value = true; // In standalone, you are the host
  activeTab.value = 'search'; // Default to search tab
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

const getTranslatedMessage = (rawMsg: string) => {
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed.key) {
      // Use i18n for translation
      const prefix = parsed.key.includes('Error') ? 'app.errors.' : 'app.systemChat.';
      return t(prefix + parsed.key, parsed.params || {});
    }
  } catch (e) {
    // If it's not valid JSON, return as is
  }
  return rawMsg;
};

const connectSocket = () => {
  if (!username.value || !roomId.value || !token.value) return;
  socket.value = io(backendUrl, { auth: { token: token.value } });
  socket.value.on('connect', () => {
    socket.value?.emit('join-room', { roomId: Number(roomId.value), username: username.value });
    isJoined.value = true;
    
    // Initial time sync
    socket.value?.emit('ping-time', Date.now());
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = window.setInterval(() => {
      socket.value?.emit('ping-time', Date.now());
    }, 5000);
  });
  
  socket.value.on('join-error', (data) => {
    alert(getTranslatedMessage(data.message));
    isJoined.value = false;
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
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
    if (data.playlist) {
      roomPlaylist.value = data.playlist;
    }
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
    
    // Auto scroll chat
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

type SyncCommand = {
  authorityId: string;
  seq: number;
  sentAt: number;
  type: string;
  payload?: any;
};

type PlayerSnapshot = {
  authorityId: string;
  seq: number;
  sentAt: number;
  url: string;
  isPlaying: boolean;
  position: number;
  songInfo?: any;
  trackId?: string;
  playMode?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const getTrackId = () => {
  const s = currentSong.value;
  return (s?.songmid ?? s?.hash ?? s?.id ?? currentUrl.value) as string;
};

const computeTargetTime = (position: number, sentAt: number, playing: boolean) => {
  if (!playing) return position;
  const elapsed = Math.max(0, getSyncedTime() - sentAt) / 1000;
  return position + elapsed;
};

const ensurePlaybackRate = (rate: number) => {
  desiredPlaybackRate.value = rate;
  if (audioRef.value && Math.abs(audioRef.value.playbackRate - rate) > 0.0001) {
    audioRef.value.playbackRate = rate;
  }
};

const applyDriftCorrection = (targetTime: number, playing: boolean) => {
  if (!audioRef.value) return;
  const audio = audioRef.value;
  const diff = targetTime - audio.currentTime;

  if (playing) {
    if (Math.abs(diff) > 1.5) {
      ensurePlaybackRate(1);
      audio.currentTime = targetTime;
      return;
    }
    
    // If drift is significant but not huge, adjust rate
    if (Math.abs(diff) > 0.05) {
      // More aggressive correction for larger drifts, but clamped to avoid excessive pitch change
      const rate = clamp(1 + diff * 0.4, 0.85, 1.15);
      ensurePlaybackRate(rate);
    } else {
      // Very close to target, return to normal speed
      ensurePlaybackRate(1);
    }
    return;
  }

  // Not playing, just sync position if out of sync
  ensurePlaybackRate(1);
  if (Math.abs(diff) > 0.05) {
    audio.currentTime = targetTime;
  }
};

const buildSnapshot = (): PlayerSnapshot | null => {
  if (!socket.value?.id) return null;
  const audio = audioRef.value;
  const position = audio ? audio.currentTime : currentTime.value;
  const playing = audio ? !audio.paused : isPlaying.value;
  return {
    authorityId: socket.value.id,
    seq: lastAppliedSeq.value,
    sentAt: getSyncedTime(),
    url: currentUrl.value,
    isPlaying: playing,
    position,
    songInfo: currentSong.value ?? undefined,
    trackId: getTrackId(),
    playMode: playMode.value,
  };
};

const applySnapshot = (snapshot: PlayerSnapshot) => {
  if (!snapshot) return;
  if (hostUserId.value && snapshot.authorityId && snapshot.authorityId !== hostUserId.value) return;

  lastAppliedSeq.value = snapshot.seq;
  if (snapshot.playMode) {
    playMode.value = snapshot.playMode as any;
  }
  const urlChanged = snapshot.url !== currentUrl.value;
  currentUrl.value = snapshot.url || '';
  if (snapshot.songInfo) {
    currentSong.value = snapshot.songInfo;
    fetchLyrics(snapshot.songInfo);
  }

  const targetTime = computeTargetTime(snapshot.position, snapshot.sentAt, snapshot.isPlaying);
  isPlaying.value = snapshot.isPlaying;
  currentTime.value = targetTime;

  if (!audioRef.value || audioRef.value.readyState === 0 || urlChanged) {
    pendingAfterLoad.value = { targetTime, shouldPlay: snapshot.isPlaying };
    return;
  }

  applyDriftCorrection(targetTime, snapshot.isPlaying);
  if (snapshot.isPlaying && audioRef.value.paused) {
    audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
  } else if (!snapshot.isPlaying && !audioRef.value.paused) {
    audioRef.value.pause();
  }
};

const applySyncCommand = (command: SyncCommand) => {
  if (!command || typeof command.seq !== 'number') return;
  const senderUser = users.value.find(u => u.id === command.authorityId);
  if (!senderUser) return;
  
  let hasPermission = senderUser.isHost || senderUser.canControl;
  if (!hasPermission && command.type === 'SEEK' && command.payload?.trackId) {
    const song = roomPlaylist.value.find(s => (s.songmid || s.hash || s.id) === command.payload!.trackId);
    if (song && song.requesterId === senderUser.id) {
      hasPermission = true;
    }
  }
  if (!hasPermission) return;

  if (command.seq <= lastAppliedSeq.value) return;
  lastAppliedSeq.value = command.seq;

  const payload = command.payload ?? {};
  const incomingTrackId = payload.trackId as string | undefined;
  const localTrackId = getTrackId();
  if (incomingTrackId && localTrackId && incomingTrackId !== localTrackId && command.type !== 'SET_TRACK') {
    socket.value?.emit('request-state', { roomId: Number(roomId.value) });
    return;
  }

  if (command.type === 'SET_TRACK') {
    const url = (payload.url ?? '') as string;
    const playing = Boolean(payload.isPlaying);
    const position = Number(payload.position ?? 0);
    const urlChanged = url !== currentUrl.value;
    currentUrl.value = url;
    if (payload.songInfo) {
      currentSong.value = payload.songInfo;
      fetchLyrics(payload.songInfo);
    }

    const targetTime = computeTargetTime(position, command.sentAt, playing);
    isPlaying.value = playing;
    currentTime.value = targetTime;

    if (!audioRef.value || audioRef.value.readyState === 0 || urlChanged) {
      pendingAfterLoad.value = { targetTime, shouldPlay: playing };
      return;
    }
    applyDriftCorrection(targetTime, playing);
    if (playing) {
      audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
    } else {
      audioRef.value.pause();
    }
    return;
  }

  if (command.type === 'CHANGE_MODE') {
    if (payload.mode) playMode.value = payload.mode;
    return;
  }

  if (!audioRef.value) return;
  const playing = command.type === 'PAUSE' ? false : Boolean(payload.isPlaying ?? !audioRef.value.paused);
  const position = Number(payload.position ?? audioRef.value.currentTime);
  const targetTime = computeTargetTime(position, command.sentAt, playing);
  isPlaying.value = playing;
  currentTime.value = targetTime;

  if (audioRef.value.readyState === 0) {
    pendingAfterLoad.value = { targetTime, shouldPlay: playing };
    return;
  }

  applyDriftCorrection(targetTime, playing);
  if (playing && audioRef.value.paused) {
    audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
  } else if (!playing && !audioRef.value.paused) {
    audioRef.value.pause();
  }
};

const sendSyncCommand = (type: string, payload?: any) => {
  if (!socket.value || !roomId.value) return;
  if (!hasControl.value && !(canSeek.value && type === 'SEEK')) return;
  lastAppliedSeq.value += 1;
  socket.value.emit('sync-command', {
    roomId: Number(roomId.value),
    command: {
      authorityId: socket.value.id,
      seq: lastAppliedSeq.value,
      sentAt: getSyncedTime(),
      type,
      payload,
    },
  });
};

const sendChat = () => {
  if (chatInput.value.trim() && socket.value) {
    socket.value.emit('chat-message', { roomId: Number(roomId.value), message: chatInput.value });
    chatInput.value = '';
  }
};

const searchMusic = async (loadMore: any = false) => {
  const isLoadMore = typeof loadMore === 'boolean' ? loadMore : false;
  if (!searchKeyword.value.trim()) return;
  if (!isLoadMore) {
    searchPage.value = 1;
    searchResults.value = [];
    searchHasMore.value = true;
  }
  if (!searchHasMore.value) return;

  isSearching.value = true;
  try {
    const resp = await axios.get(`${backendUrl}/api/search`, {
      params: { keyword: searchKeyword.value, source: searchSource.value, page: searchPage.value, limit: 20 }
    });
    if (resp.data.list && resp.data.list.length > 0) {
      searchResults.value = isLoadMore ? [...searchResults.value, ...resp.data.list] : resp.data.list;
      searchPage.value++;
    } else {
      searchHasMore.value = false;
    }
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    isSearching.value = false;
  }
};

const handleSearchScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
    if (!isSearching.value && searchHasMore.value) {
      searchMusic(true);
    }
  }
};

const addToRoomPlaylist = (song: any) => {
  if (socket.value) {
    const trackId = song.songmid || song.hash || song.id;
    if (roomPlaylist.value.some(s => (s.songmid || s.hash || s.id) === trackId)) {
      // Use toast or alert
      alert(t('app.songAlreadyInPlaylist'));
      return;
    }
    socket.value.emit('add-song', { roomId: Number(roomId.value), song });
  }
};

const removeSong = (index: number) => {
  if (!hasControl.value) return;
  if (socket.value) {
    socket.value.emit('remove-song', { roomId: Number(roomId.value), index });
  }
};

const playSong = async (song: any, context?: 'search' | 'playlist' | 'room') => {
  if (!hasPermission('SKIP_SONG')) {
    alert(t('app.notHost'));
    return;
  }
  if (roomMode.value === 'democracy' && !hasControl.value) {
    initiateVote('SKIP_SONG'); // Technically should vote for specific song, but let's just do skip for simplicity, or show an alert
    alert(t('app.cannotSkipDemocracy'));
    return;
  }
  if (!hasControl.value) return;
  if (context) {
    currentContext.value = context;
  }
  if (!lxEngine.value || !lxEngine.value.isInited) return;
  isLoadingUrl.value = true;
  isChangingSong.value = true;
  try {
    const musicInfo = { 
      songmid: song.songmid, 
      hash: song.hash || song.songmid,
      name: song.name,
      singer: song.singer 
    };
    const response: any = await lxEngine.value.requestMusicUrl(song.source, musicInfo, songQuality.value);
    const isSameUrl = currentUrl.value === response;
    currentUrl.value = response;
    currentSong.value = song;
    isPlaying.value = true;
    currentTime.value = 0;
    fetchLyrics(song);
    
    if (socket.value && hasControl.value) {
      sendSyncCommand('SET_TRACK', {
        url: currentUrl.value,
        isPlaying: true,
        position: 0,
        songInfo: { ...song, quality: songQuality.value },
        trackId: song.songmid ?? song.hash ?? song.id ?? currentUrl.value,
      });
    }
    
    await nextTick();
    if (audioRef.value) {
      if (isSameUrl) {
        audioRef.value.currentTime = 0;
      }
      audioRef.value.play().catch(e => console.error("Auto-play prevented", e));
    }
  } catch (error: any) {
    console.error(error);
  } finally {
    isLoadingUrl.value = false;
    isChangingSong.value = false;
  }
};

const onPlay = () => { 
  if (!hasControl.value) return;
  if (isChangingSong.value) return;
  if (!audioRef.value) return;
  isPlaying.value = true;
  sendSyncCommand('PLAY', { position: audioRef.value.currentTime, isPlaying: true, trackId: getTrackId() });
};
const onPause = () => { 
  if (!hasControl.value) return;
  if (isChangingSong.value) {
    return;
  }
  if (audioRef.value && audioRef.value.readyState === 0) {
    // The browser aborted previous playback to load a new src.
    // This is not a user-initiated pause, so do not sync it.
    return;
  }
  if (!audioRef.value) return;
  isPlaying.value = false;
  sendSyncCommand('PAUSE', { position: audioRef.value.currentTime, isPlaying: false, trackId: getTrackId() });
};
const onSeeked = () => { 
  if (!canSeek.value) return;
  if (!audioRef.value) return;
  sendSyncCommand('SEEK', { position: audioRef.value.currentTime, isPlaying: !audioRef.value.paused, trackId: getTrackId() });
};
const onSeeking = () => {
  if (!canSeek.value) return;
};
const onRateChange = () => {
  if (!audioRef.value) return;
  if (hasControl.value) {
    if (audioRef.value.playbackRate !== 1) audioRef.value.playbackRate = 1;
    return;
  }
  if (Math.abs(audioRef.value.playbackRate - desiredPlaybackRate.value) > 0.0001) {
    audioRef.value.playbackRate = desiredPlaybackRate.value;
  }
};
const onTimeUpdate = () => {
  if (!audioRef.value) return;
  updateLyricIndex(audioRef.value.currentTime);
  currentTime.value = audioRef.value.currentTime;
};

const playNextSong = (manual = false) => {
  if (manual) {
    if (!hasPermission('SKIP_SONG')) {
      alert(t('app.noPermissionSkip'));
      return;
    }
    if (roomMode.value === 'democracy' && !hasControl.value) {
      initiateVote('SKIP_SONG');
      return;
    }
  }
  
  if (!hasControl.value) return;

  const list = currentContext.value === 'search' ? searchResults.value : (currentContext.value === 'playlist' ? playlist.value : roomPlaylist.value);
  if (list.length === 0) return;

  if (playMode.value === 'single-loop' && !manual) {
    if (audioRef.value) {
      audioRef.value.currentTime = 0;
      audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
    }
    return;
  }

  if (playMode.value === 'random') {
    const randomIndex = Math.floor(Math.random() * list.length);
    playSong(list[randomIndex], currentContext.value);
    return;
  }

  const currentIndex = list.findIndex(s => (s.songmid || s.hash || s.id) === getTrackId());
  let nextIndex = currentIndex + 1;
  if (nextIndex >= list.length) nextIndex = 0;
  playSong(list[nextIndex], currentContext.value);
};

const playPrevSong = () => {
  if (!hasPermission('SKIP_SONG')) {
    alert(t('app.noPermissionSkip'));
    return;
  }
  if (roomMode.value === 'democracy' && !hasControl.value) {
    initiateVote('SKIP_SONG');
    return;
  }
  if (!hasControl.value) return;

  const list = currentContext.value === 'search' ? searchResults.value : (currentContext.value === 'playlist' ? playlist.value : roomPlaylist.value);
  if (list.length === 0) return;

  if (playMode.value === 'random') {
    const randomIndex = Math.floor(Math.random() * list.length);
    playSong(list[randomIndex], currentContext.value);
    return;
  }

  const currentIndex = list.findIndex(s => (s.songmid || s.hash || s.id) === getTrackId());
  let prevIndex = currentIndex - 1;
  if (prevIndex < 0) prevIndex = list.length - 1;
  playSong(list[prevIndex], currentContext.value);
};

const onEnded = () => {
  if (!hasControl.value) return;
  playNextSong(false);
};

const togglePlayPause = () => {
  if (!hasPermission('PLAY_PAUSE') || !audioRef.value) return;
  if (audioRef.value.paused) {
    audioRef.value.play().catch(e => console.error('Play prevented', e));
  } else {
    audioRef.value.pause();
  }
};

const togglePlayMode = () => {
  if (!hasControl.value) return;
  if (playMode.value === 'list-loop') playMode.value = 'single-loop';
  else if (playMode.value === 'single-loop') playMode.value = 'random';
  else playMode.value = 'list-loop';
  
  sendSyncCommand('CHANGE_MODE', { mode: playMode.value });
};

const seekTo = (e: Event) => {
  if (!canSeek.value) return;
  const val = Number((e.target as HTMLInputElement).value);
  if (audioRef.value) {
    audioRef.value.currentTime = val;
  }
};

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

watch(volume, (val) => {
  if (audioRef.value) {
    audioRef.value.volume = val;
  }
});

const onLoadedMetadata = () => {
  if (audioRef.value) {
    duration.value = audioRef.value.duration;
    if (pendingAfterLoad.value) {
      const { targetTime, shouldPlay } = pendingAfterLoad.value;
      pendingAfterLoad.value = null;
      ensurePlaybackRate(shouldPlay ? desiredPlaybackRate.value : 1);
      audioRef.value.currentTime = targetTime;
      if (shouldPlay) {
        audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
      } else {
        audioRef.value.pause();
      }
      return;
    }
    audioRef.value.currentTime = currentTime.value;
    if (isPlaying.value) audioRef.value.play().catch(e => console.error('Auto-play prevented', e));
  }
};

onUnmounted(() => { if (socket.value) socket.value.disconnect(); });

watch(
  () => [isHost.value, isJoined.value],
  ([nextIsHost, nextIsJoined]) => {
    if (hostHeartbeatTimer) {
      clearInterval(hostHeartbeatTimer);
      hostHeartbeatTimer = null;
    }
    if (!nextIsJoined || !nextIsHost) return;

    ensurePlaybackRate(1);
    hostHeartbeatTimer = window.setInterval(() => {
      if (!isHost.value || !socket.value || !audioRef.value) return;
      if (!currentUrl.value) return;
      const audio = audioRef.value;
      sendSyncCommand('SYNC', { position: audio.currentTime, isPlaying: !audio.paused, trackId: getTrackId() });
    }, 1000);
  },
  { immediate: true }
);

watch(isLoggedIn, (val) => {
  if (val) {
    fetchPlaylist();
  }
}, { immediate: true });
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[var(--color-near-black)] text-[var(--color-text-white)] font-spotify overflow-hidden selection:bg-[var(--color-spotify-green)] selection:text-[var(--color-near-black)]">
    
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-6 bg-[var(--color-near-black)] z-50 flex-shrink-0">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-[var(--color-spotify-green)] rounded-full flex items-center justify-center">
          <svg class="w-4 h-4 text-[var(--color-near-black)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h1 class="font-spotify-title font-bold text-2xl tracking-tight">{{ t('app.title') }}</h1>
      </div>
      
      <div class="flex items-center space-x-6">
        <div v-if="isJoined" class="flex items-center space-x-4">
          <div class="flex items-center space-x-2 bg-[var(--color-mid-dark)] px-4 py-1.5 rounded-[500px]">
            <span class="w-2 h-2 rounded-full bg-[var(--color-spotify-green)]" :class="{'animate-pulse': isPlaying}"></span>
            <span class="text-xs text-[var(--color-text-silver)] font-semibold">{{ t('app.freq') }}: {{ roomId }}</span>
          </div>
          <div class="text-xs text-[var(--color-text-white)] px-4 py-1.5 bg-[var(--color-mid-dark)] rounded-[500px] font-semibold">
            {{ t('app.op') }}: {{ username }}
          </div>
          <!-- Mode Tag -->
          <div class="relative group cursor-pointer">
            <div class="text-xs px-4 py-1.5 rounded-[500px] font-semibold flex items-center space-x-1 transition-colors" :class="roomMode === 'dictator' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-blue-900/50 text-blue-200 border border-blue-800'">
              <span>{{ roomMode === 'dictator' ? t('app.dictatorMode') : t('app.democracyMode') }}</span>
              <svg class="w-3 h-3 ml-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <!-- Hover Permissions Card -->
            <div class="absolute top-full right-0 pt-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div class="p-4 bg-[var(--color-dark-surface)] border border-[var(--color-border-gray)] rounded-[8px] shadow-[var(--shadow-spotify-heavy)] pointer-events-auto">
                  <div class="text-sm font-bold text-[var(--color-text-white)] mb-2">{{ roomMode === 'dictator' ? t('app.dictatorMode') : t('app.democracyMode') }}</div>
                  <ul class="text-xs text-[var(--color-text-silver)] space-y-1">
                    <li v-if="roomMode === 'dictator'">{{ t('app.ruleAllCanAdd') }}</li>
                    <li v-if="roomMode === 'dictator'">{{ t('app.ruleDictatorControl') }}</li>
                    <li v-if="roomMode === 'democracy'">{{ t('app.ruleAllCanAdd') }}</li>
                    <li v-if="roomMode === 'democracy'">{{ t('app.ruleDemocracyControl') }}</li>
                    <li v-if="roomMode === 'democracy'">{{ t('app.ruleDemocracyVote') }}</li>
                  </ul>
                  <div v-if="isHost" class="mt-3 pt-3 border-t border-[var(--color-border-gray)]">
                      <button @click="changeRoomMode(roomMode === 'dictator' ? 'democracy' : 'dictator')" class="w-full py-1.5 bg-[var(--color-mid-dark)] hover:bg-[var(--color-text-white)] hover:text-[var(--color-near-black)] text-[var(--color-text-white)] text-xs font-bold rounded-[500px] transition-colors">
                        {{ t('app.switchModeTo') }}{{ roomMode === 'dictator' ? t('app.democracyMode') : t('app.dictatorMode') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        <div v-else-if="isStandalone" class="flex items-center space-x-4">
          <div class="flex items-center space-x-2 bg-[var(--color-mid-dark)] px-4 py-1.5 rounded-[500px]">
            <span class="w-2 h-2 rounded-full bg-[var(--color-spotify-green)]" :class="{'animate-pulse': isPlaying}"></span>
            <span class="text-xs text-[var(--color-text-silver)] font-semibold">{{ t('app.standalone') }}</span>
          </div>
          <button @click="handleLogout" class="text-xs text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">{{ t('app.logout') }}</button>
        </div>
        <button @click="toggleLanguage" class="text-sm font-semibold text-[var(--color-text-white)] hover:text-[var(--color-spotify-green)] transition-colors px-4 py-2 bg-[var(--color-mid-dark)] rounded-[500px]">
          {{ locale === 'en' ? '中' : 'EN' }}
        </button>
      </div>
    </header>

    <!-- Global Toast for Voting -->
    <transition name="fade">
      <div v-if="activeVote" class="fixed top-24 left-1/2 transform -translate-x-1/2 bg-[var(--color-dark-surface)] border border-[var(--color-border-gray)] rounded-[8px] p-4 shadow-[var(--shadow-spotify-heavy)] z-[100] flex flex-col items-center space-y-3 min-w-[300px]">
        <div class="text-sm font-bold text-[var(--color-text-white)]">
          {{ activeVote.initiatorName }}{{ t('app.initiatedVote') }}
        </div>
        <div class="text-xs text-[var(--color-text-silver)] font-semibold">
          {{ activeVote.type === 'SKIP_SONG' ? t('app.voteTypeSkip') : (activeVote.type === 'CHANGE_HOST' ? `${t('app.voteTypeChangeHost')}${activeVote.targetName}` : `${t('app.voteTypeKick')}${activeVote.targetName}`) }}
        </div>
        
        <template v-if="!activeVote.result">
          <div class="w-full bg-[var(--color-near-black)] h-2 rounded-full overflow-hidden flex">
            <div class="h-full bg-[var(--color-spotify-green)] transition-all" :style="{ width: `${(activeVote.yesCount / activeVote.required) * 100}%` }"></div>
          </div>
          <div class="flex items-center justify-between w-full text-xs font-mono text-[var(--color-text-silver)]">
            <span>{{ t('app.agreedCount') }}{{ activeVote.yesCount }} / {{ activeVote.required }}</span>
            <span>{{ t('app.rejectedCount') }}{{ activeVote.noCount }}</span>
          </div>
          <div v-if="!activeVote.hasVoted" class="flex space-x-2 w-full">
            <button @click="voteYes" class="flex-1 bg-[var(--color-spotify-green)] text-[var(--color-near-black)] py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase">
              {{ t('app.agree') }}
            </button>
            <button @click="voteNo" class="flex-1 bg-red-500 text-white py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase">
              {{ t('app.reject') }}
            </button>
          </div>
          <div v-else class="w-full text-center text-xs text-[var(--color-text-silver)] py-1.5 font-bold uppercase">
            {{ t('app.voted') }}
          </div>
        </template>

        <template v-else>
          <div class="w-full text-center text-sm font-bold py-2 uppercase" :class="activeVote.result === 'passed' ? 'text-[var(--color-spotify-green)]' : 'text-red-500'">
            {{ activeVote.result === 'passed' ? t('app.votePassed') : t('app.voteFailed') }}
          </div>
        </template>

        <button v-if="!activeVote.result" @click="activeVote = null" class="w-full bg-[var(--color-mid-dark)] text-[var(--color-text-white)] py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase mt-2">
          {{ t('app.close') }}
        </button>
      </div>
    </transition>

    <!-- Global Toast for Mode Switch -->
    <transition name="fade">
      <div v-if="modeToast" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--color-dark-surface)]/90 backdrop-blur-md border border-[var(--color-border-gray)] rounded-[16px] p-8 shadow-[var(--shadow-spotify-heavy)] z-[100] flex flex-col items-center space-y-4 pointer-events-none">
        <div class="w-16 h-16 rounded-full bg-[var(--color-mid-dark)] flex items-center justify-center">
          <svg v-if="roomMode === 'dictator'" class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z"/></svg>
          <svg v-else class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </div>
        <div class="text-xl font-bold text-[var(--color-text-white)] tracking-wide">
          {{ modeToast }}
        </div>
      </div>
    </transition>

    <!-- Auth & Connect -->
    <transition name="fade">
      <main v-if="!isJoined && !isStandalone" class="flex-grow flex items-center justify-center relative bg-[var(--color-near-black)]">
        <div class="w-full max-w-[450px] p-12 bg-[var(--color-dark-surface)] rounded-[8px] relative z-10 shadow-[var(--shadow-spotify-heavy)]">
          <div v-if="!isLoggedIn">
            <h2 class="font-spotify-title text-3xl font-bold mb-2 tracking-tight text-[var(--color-text-white)] text-center">{{ isLoginMode ? t('app.login') : t('app.register') }}</h2>
            <p class="text-[var(--color-text-silver)] text-sm mb-8 text-center font-semibold">{{ t('app.authRequired') }}</p>
            
            <div class="space-y-5">
              <div class="space-y-2">
                <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.username') }}</label>
                <input v-model="username" @keyup.enter="handleAuth" type="text" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.username')">
              </div>
              <div class="space-y-2">
                <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.password') }}</label>
                <input v-model="password" @keyup.enter="handleAuth" type="password" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.password')">
              </div>
              <div v-if="isLoginMode" class="flex items-center space-x-3 mt-2">
                <input type="checkbox" v-model="rememberPassword" id="rememberMe" class="accent-[var(--color-spotify-green)] w-4 h-4 cursor-pointer">
                <label for="rememberMe" class="text-sm text-[var(--color-text-silver)] cursor-pointer select-none">{{ t('app.rememberMe') }}</label>
              </div>
              <button @click="handleAuth" class="w-full bg-[var(--color-spotify-green)] text-[var(--color-near-black)] p-3.5 rounded-[500px] font-bold text-base hover:scale-105 transition-transform mt-8 flex items-center justify-center space-x-2 tracking-[1.4px] uppercase">
                <span>{{ isLoginMode ? t('app.login') : t('app.register') }}</span>
              </button>
              <div class="text-center mt-6">
                <button @click="isLoginMode = !isLoginMode" class="text-sm font-semibold text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">
                  {{ isLoginMode ? t('app.needAccount') : t('app.haveAccount') }}
                </button>
              </div>
            </div>
          </div>
          
          <div v-else>
            <h2 class="font-spotify-title text-3xl font-bold mb-2 tracking-tight text-[var(--color-text-white)] text-center">{{ t('app.joinRoom') }}</h2>
            <p class="text-[var(--color-text-silver)] text-sm mb-8 text-center font-semibold">{{ t('app.welcome', { username }) }}</p>
            
            <div class="space-y-5">
              <div class="space-y-2">
                <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.channelId') }}</label>
                <input v-model.number="roomId" @keyup.enter="connectSocket" type="number" min="1" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" placeholder="e.g. 8888">
              </div>
              <div class="grid grid-cols-2 gap-3 mt-8">
                <button @click="connectSocket" class="w-full bg-[var(--color-spotify-green)] text-[var(--color-near-black)] p-3.5 rounded-[500px] font-bold text-sm hover:scale-105 transition-transform flex items-center justify-center space-x-2 tracking-[1px] uppercase">
                  <span>{{ t('app.connect') }}</span>
                </button>
                <button @click="startStandaloneMode" class="w-full bg-[var(--color-mid-dark)] text-[var(--color-text-white)] p-3.5 rounded-[500px] font-bold text-sm hover:bg-[var(--color-text-silver)] hover:text-[var(--color-near-black)] transition-colors flex items-center justify-center space-x-2 tracking-[1px]">
                  <span>{{ t('app.standalone') }}</span>
                </button>
              </div>
              <div class="text-center mt-6">
                <button @click="handleLogout" class="text-sm font-semibold text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">
                  {{ t('app.logout') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Main Dashboard -->
      <main v-else class="flex-grow flex overflow-hidden bg-[var(--color-near-black)] p-2 gap-2">
        
        <!-- Left Sidebar: Database Search & Playlist -->
        <aside class="w-[350px] flex-shrink-0 flex flex-col bg-[var(--color-near-black)] rounded-[8px] z-20 relative overflow-hidden">
          
          <!-- Tabs as navigation pills -->
          <div class="flex space-x-2 p-4 bg-[var(--color-near-black)]">
            <button v-if="!isStandalone" @click="activeTab = 'room'" :class="activeTab === 'room' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
              {{ t('app.roomPlaylist') }}
            </button>
            <button @click="activeTab = 'search'" :class="activeTab === 'search' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
              {{ t('app.search') }}
            </button>
            <button @click="activeTab = 'playlist'" :class="activeTab === 'playlist' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
              {{ t('app.playlist') }}
            </button>
          </div>

          <div class="flex-grow flex flex-col bg-[var(--color-near-black)] rounded-[8px] overflow-hidden mx-2 mb-2">
            <div v-if="activeTab === 'search'" class="p-4 flex flex-col space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.audioDb') }}</span>
                <div class="flex space-x-1">
                  <button v-for="s in [{id:'kw',n:'KW'}, {id:'kg',n:'KG'}, {id:'tx',n:'TX'}, {id:'wy',n:'WY'}]" :key="s.id" @click="searchSource = s.id" 
                          :class="{'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]': searchSource === s.id, 'text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]': searchSource !== s.id}" 
                          class="px-3 py-1 text-xs font-semibold rounded-[9999px] transition-colors">
                    {{ s.n }}
                  </button>
                </div>
              </div>
              <div class="relative">
                <input v-model="searchKeyword" @keyup.enter="searchMusic" type="text" class="w-full bg-[var(--color-dark-surface)] p-3 pl-10 text-sm focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] hover:bg-[var(--color-mid-dark)] focus:bg-[var(--color-mid-dark)] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.query')">
                <svg class="absolute left-3 top-3 w-5 h-5 text-[var(--color-text-silver)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
            </div>
            
            <div class="flex-grow overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar" @scroll="handleSearchScroll">
              <div v-if="!hasControl" class="mb-4 text-[var(--color-text-silver)] text-sm font-semibold text-center flex items-center justify-center space-x-2">
                <span>{{ t('app.onlyHostCanControlPlayback') }}</span>
              </div>

              <template v-if="activeTab === 'search'">
                <div v-if="isSearching && searchPage === 1" class="flex items-center justify-center py-10">
                  <div class="w-8 h-8 border-4 border-[var(--color-spotify-green)] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div v-else-if="searchResults.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
                  {{ t('app.noResults') }}
                </div>
                <div v-for="song in searchResults" :key="song.songmid" class="group flex items-center justify-between p-2 rounded-[6px] transition-all hover:bg-[var(--color-dark-surface)] cursor-pointer" @click="addToRoomPlaylist(song)">
                  <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors">
                      <svg class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div class="min-w-0">
                      <div class="text-base font-semibold truncate text-[var(--color-text-white)]">{{ song.name }}</div>
                      <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }}</div>
                    </div>
                  </div>
                  <button @click.stop="togglePlaylist(song)" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] p-2 transition-colors focus:outline-none z-10 relative">
                    <svg v-if="isInPlaylist(song)" class="w-5 h-5 text-[var(--color-spotify-green)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </button>
                </div>
                <div v-if="isSearching && searchPage > 1" class="flex items-center justify-center py-4">
                  <div class="w-5 h-5 border-2 border-[var(--color-spotify-green)] border-t-transparent rounded-full animate-spin"></div>
                </div>
              </template>

              <template v-else-if="activeTab === 'playlist'">
                <div v-if="playlist.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
                  {{ t('app.emptyPlaylist') }}
                </div>
                <div v-for="song in playlist" :key="song.songmid" class="group flex items-center justify-between p-2 rounded-[6px] transition-all hover:bg-[var(--color-dark-surface)] cursor-pointer" @click="addToRoomPlaylist(song)">
                  <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors">
                      <svg class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div class="min-w-0">
                      <div class="text-base font-semibold truncate text-[var(--color-text-white)]">{{ song.name }}</div>
                      <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }}</div>
                    </div>
                  </div>
                  <button @click.stop="togglePlaylist(song)" class="text-[var(--color-spotify-green)] hover:text-[var(--color-text-white)] p-2 transition-colors focus:outline-none z-10 relative">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>
              </template>

              <template v-else-if="activeTab === 'room'">
                <div v-if="roomPlaylist.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
                  {{ t('app.emptyRoomPlaylist') }}
                </div>
                <div v-for="(song, index) in roomPlaylist" :key="index" class="group flex items-center justify-between p-2 rounded-[6px] transition-all" :class="[hasControl ? 'hover:bg-[var(--color-dark-surface)] cursor-pointer' : 'opacity-50 cursor-not-allowed', (song.songmid || song.hash || song.id) === getTrackId() ? 'bg-[var(--color-dark-surface)]' : '']" @click="playSong(song, 'room')">
                  <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors relative">
                      <svg v-if="(song.songmid || song.hash || song.id) !== getTrackId()" class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      <div v-else class="flex space-x-[2px] h-4 items-end w-4 justify-center">
                        <div v-for="i in 3" :key="i" class="w-1 bg-[var(--color-spotify-green)] rounded-sm" :class="{'animate-pulse': isPlaying}" :style="{height: isPlaying ? `${Math.max(40, Math.random() * 100)}%` : '40%'}"></div>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <div class="text-base font-semibold truncate" :class="(song.songmid || song.hash || song.id) === getTrackId() ? 'text-[var(--color-spotify-green)]' : 'text-[var(--color-text-white)]'">{{ song.name }}</div>
                      <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }} <span v-if="song.requesterName" class="ml-2 text-xs opacity-70">({{ song.requesterName }}{{ t('app.requesterSuffix') }})</span></div>
                    </div>
                  </div>
                  <button @click.stop="removeSong(index)" v-if="hasControl" class="text-[var(--color-text-silver)] hover:text-red-500 p-2 transition-colors focus:outline-none z-10 relative opacity-0 group-hover:opacity-100">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </aside>

        <!-- Center: Player Stage -->
        <section class="flex-grow flex flex-col relative bg-[var(--color-near-black)] rounded-[8px] overflow-hidden shadow-[var(--shadow-spotify-heavy)]">
          <!-- Top: Track Info -->
          <div class="px-8 pt-8 pb-6 flex-shrink-0 z-10 bg-gradient-to-b from-[var(--color-dark-surface)] to-[var(--color-near-black)]">
            <div class="flex flex-col justify-between gap-4 h-full">
              <div class="max-w-full">
                <div class="text-sm font-bold text-[var(--color-text-white)] uppercase tracking-[1.4px] mb-4 flex items-center">
                  <span class="w-2 h-2 bg-[var(--color-spotify-green)] rounded-full mr-3" :class="{'animate-pulse': isPlaying}"></span>
                  {{ t('app.nowPlaying') }}
                </div>
                <h2 class="font-spotify-title text-5xl md:text-7xl font-bold tracking-tighter text-[var(--color-text-white)] mb-4 truncate leading-none">{{ currentSong?.name || t('app.idle') }}</h2>
                <p class="text-lg md:text-2xl font-bold text-[var(--color-text-silver)]">{{ currentSong?.singer || t('app.waitingTrack') }}</p>
              </div>
              <div class="text-sm text-[var(--color-text-silver)] font-semibold flex items-center space-x-4">
                <div class="flex items-center space-x-2">
                  <span>{{ t('app.mode') }}: {{ isHost ? t('app.master') : (hasControl ? 'Controller' : t('app.slave')) }}</span>
                </div>
                <select v-model="songQuality" class="bg-transparent text-[var(--color-text-white)] font-semibold focus:outline-none cursor-pointer border-b border-[var(--color-border-gray)]">
                  <option class="bg-[var(--color-dark-surface)]" value="128k">{{ t('app.quality.std') }}</option>
                  <option class="bg-[var(--color-dark-surface)]" value="320k">{{ t('app.quality.hq') }}</option>
                  <option class="bg-[var(--color-dark-surface)]" value="flac">{{ t('app.quality.lossless') }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Middle: Lyrics -->
          <div class="flex-grow relative z-10 overflow-hidden mb-6">
            <div ref="lyricScrollRef" class="absolute inset-0 overflow-y-auto scroll-smooth custom-scrollbar px-8 md:px-12 py-[20%] lyric-mask">
              <div v-for="(line, index) in lyrics" :key="index" 
                   :class="['lyric-line text-left py-2 md:py-3 text-2xl md:text-4xl font-bold tracking-tight', { 'active': index === currentLyricIndex }]" 
                   :id="`lyric-${index}`">
                {{ line.text }}
              </div>
              <div v-if="lyrics.length === 0" class="text-left py-10 text-2xl font-bold text-[var(--color-text-silver)] opacity-50">
                {{ t('app.noLyric') }}
              </div>
            </div>
          </div>

          <!-- Bottom: Custom Player UI -->
          <div class="px-6 py-4 bg-[var(--color-near-black)] z-10 flex-shrink-0 flex items-center justify-between border-t border-[var(--color-dark-surface)] h-24">
            <audio ref="audioRef" class="hidden" :src="currentUrl" @play="onPlay" @pause="onPause" @seeked="onSeeked" @seeking="onSeeking" @timeupdate="onTimeUpdate" @ratechange="onRateChange" @loadedmetadata="onLoadedMetadata" @ended="onEnded"></audio>

            <!-- Left: Empty or Mini Info -->
            <div class="flex-1 min-w-0">
              <!-- Optionally show current track info here for larger screens -->
            </div>

            <!-- Center: Playback Controls & Progress Bar -->
            <div class="flex flex-col items-center justify-center flex-1 max-w-2xl w-full">
              <div class="flex items-center space-x-6 mb-2">
                <!-- Play Mode Toggle -->
                <button @click="togglePlayMode" :disabled="!hasControl" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t(`app.player.${playMode.replace('-loop', 'Loop')}`)">
                  <svg v-if="playMode === 'list-loop'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <svg v-else-if="playMode === 'single-loop'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    <text x="12" y="16" font-size="10" text-anchor="middle" fill="currentColor" stroke="none" font-weight="bold">1</text>
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>

                <!-- Previous Track -->
                <button @click="playPrevSong" :disabled="!hasPermission('SKIP_SONG')" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t('app.player.prev')">
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                </button>

                <!-- Play / Pause -->
                <button @click="togglePlayPause" :disabled="!hasPermission('PLAY_PAUSE')" class="w-9 h-9 flex items-center justify-center bg-[var(--color-text-white)] text-[var(--color-near-black)] rounded-full hover:scale-105 disabled:opacity-50 transition-transform" :title="isPlaying ? t('app.player.pause') : t('app.player.play')">
                  <svg v-if="isPlaying" class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  <svg v-else class="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>

                <!-- Next Track -->
                <button @click="playNextSong(true)" :disabled="!hasPermission('SKIP_SONG')" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t('app.player.next')">
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                </button>

                <!-- Visualizer Hint -->
                <div class="hidden md:flex space-x-[2px] h-4 items-end w-8 flex-shrink-0 ml-4">
                  <div v-for="i in 4" :key="i" class="w-1 bg-[var(--color-spotify-green)] transition-all duration-150 rounded-sm" :style="{height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '20%'}"></div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="w-full flex items-center space-x-3 text-xs text-[var(--color-text-silver)] font-mono">
                <span class="w-10 text-right">{{ formatTime(currentTime) }}</span>
                <input type="range" :min="0" :max="duration || 100" :value="currentTime" @input="seekTo" :disabled="!canSeek" class="flex-grow h-1 bg-[var(--color-dark-surface)] rounded-full appearance-none cursor-pointer accent-[var(--color-text-white)] hover:accent-[var(--color-spotify-green)] custom-range">
                <span class="w-10">{{ formatTime(duration) }}</span>
              </div>
            </div>

            <!-- Right: Volume Control -->
            <div class="flex-1 flex justify-end items-center space-x-3">
              <svg class="w-4 h-4 text-[var(--color-text-silver)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5 10h4l5-5v14l-5-5H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
              </svg>
              <input type="range" min="0" max="1" step="0.01" v-model="volume" class="w-24 h-1 bg-[var(--color-dark-surface)] rounded-full appearance-none cursor-pointer accent-[var(--color-text-white)] hover:accent-[var(--color-spotify-green)] custom-range" :title="t('app.player.volume')">
            </div>
          </div>
        </section>

        <!-- Right Sidebar: Terminals/Chat -->
        <aside v-if="!isStandalone" class="w-[300px] flex-shrink-0 flex flex-col bg-[var(--color-near-black)] rounded-[8px] z-20 hidden lg:flex overflow-hidden">
          <!-- Active Nodes -->
          <div class="h-1/3 flex flex-col bg-[var(--color-dark-surface)] mb-2 rounded-[8px]">
            <div class="p-4">
              <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.activeNodes') }} ({{ users.length }})</span>
            </div>
            <div class="flex-grow overflow-y-auto p-4 pt-0 space-y-3 custom-scrollbar">
              <div v-for="u in users" :key="u.id" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-2 h-2 rounded-full" :class="u.isHost ? 'bg-[var(--color-spotify-green)]' : 'bg-[var(--color-text-silver)]'"></div>
                  <span class="text-sm font-semibold text-[var(--color-text-white)] truncate">{{ u.username }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span v-if="u.id === socket?.id" class="text-xs text-[var(--color-near-black)] font-bold px-2 py-0.5 rounded-[500px] bg-[var(--color-text-white)]">{{ t('app.me') }}</span>
                  <template v-if="isHost && u.id !== socket?.id">
                    <button @click="passHost(u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.transferHostTitle')">H</button>
                    <button v-if="!u.canControl" @click="grantControl(u.id)" class="text-xs bg-[var(--color-text-silver)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.grantControlTitle')">C</button>
                    <button v-else @click="revokeControl(u.id)" class="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.revokeControlTitle')">-C</button>
                    <button @click="kickUser(u.id)" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.kickUserTitle')">K</button>
                  </template>
                  <template v-else-if="roomMode === 'democracy'">
                    <template v-if="u.id !== socket?.id">
                      <button v-if="!u.isHost" @click="initiateVote('CHANGE_HOST', u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.voteHostTitle')">V:H</button>
                      <button @click="initiateVote('KICK_USER', u.id)" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.voteKickTitle')">V:K</button>
                    </template>
                    <template v-else>
                      <button v-if="!u.isHost" @click="initiateVote('CHANGE_HOST', u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform ml-2" :title="t('app.voteHostTitle')">V:H</button>
                    </template>
                  </template>
                  <span v-if="u.canControl && u.id !== socket?.id && !isHost" class="text-xs text-[var(--color-text-silver)] font-bold px-2 py-0.5 border border-[var(--color-text-silver)] rounded-[500px]">C</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Chat / Log -->
          <div class="flex-grow flex flex-col min-h-0 bg-[var(--color-dark-surface)] rounded-[8px]">
            <div class="p-4 flex-shrink-0">
              <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.commsLog') }}</span>
            </div>
            <div id="chat-scroll" class="flex-grow overflow-y-auto px-4 space-y-4 custom-scrollbar">
              <div v-for="(msg, i) in chatMessages" :key="i">
                <div v-if="msg.isSystem" class="text-xs text-[var(--color-text-silver)] font-semibold text-center py-2">
                  {{ msg.message }}
                </div>
                <div v-else class="space-y-1">
                  <div class="text-xs font-semibold text-[var(--color-text-silver)]">{{ msg.sender }}</div>
                  <div class="text-sm font-semibold text-[var(--color-text-white)] break-words">
                    {{ msg.message }}
                  </div>
                </div>
              </div>
            </div>
            <div class="p-4 flex-shrink-0">
              <div class="relative flex items-center">
                <input v-model="chatInput" @keyup.enter="sendChat" type="text" class="w-full bg-[var(--color-mid-dark)] p-3 pr-16 text-sm focus:outline-none text-[var(--color-text-white)] placeholder-[var(--color-text-silver)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.inputMessage')">
                <button @click="sendChat" class="absolute right-2 top-1.5 bottom-1.5 px-4 bg-[var(--color-text-white)] hover:bg-[var(--color-spotify-green)] hover:scale-105 text-[var(--color-near-black)] transition-all font-bold text-xs uppercase tracking-[1.4px] rounded-[500px] flex items-center justify-center">
                  {{ t('app.send') }}
                </button>
              </div>
            </div>
          </div>
        </aside>

      </main>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>
