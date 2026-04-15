import { ref, computed } from 'vue';
import { Socket } from 'socket.io-client';
import { LxEngine } from '../utils/lx-engine';

export const backendUrl = import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3000';

// Socket & Time
export const socket = ref<Socket | null>(null);
export const serverTimeOffset = ref(0);
export const getSyncedTime = () => Date.now() + serverTimeOffset.value;

// Auth
export const username = ref(localStorage.getItem('username') || '');
export const password = ref('');
export const token = ref(localStorage.getItem('token') || '');
export const isLoggedIn = ref(!!localStorage.getItem('token'));
export const isLoginMode = ref(true);
export const rememberPassword = ref(localStorage.getItem('rememberPassword') === 'true');

// Room
export const roomId = ref<number | ''>('');
export const isJoined = ref(false);
export const isStandalone = ref(false);
export const users = ref<any[]>([]);
export const isHost = ref(false);
export const roomMode = ref<'dictator'|'democracy'>('dictator');
export const hostUserId = ref<string | null>(null);

export const hasControl = computed(() => {
  if (isStandalone.value) return true;
  return isHost.value || !!(users.value.find(u => u.id === socket.value?.id)?.canControl);
});

// Permissions
type Action = 'PLAY_PAUSE' | 'SEEK' | 'SKIP_SONG' | 'ADD_SONG' | 'CHANGE_MODE' | 'KICK_USER' | 'CHANGE_HOST';
export const hasPermission = (action: Action): boolean => {
  if (isStandalone.value) return true;
  if (isHost.value) return true;

  if (roomMode.value === 'dictator') {
    if (action === 'ADD_SONG') return true;
    if (action === 'PLAY_PAUSE' || action === 'SEEK' || action === 'SKIP_SONG') return hasControl.value;
    return false;
  } else if (roomMode.value === 'democracy') {
    if (action === 'ADD_SONG') return true;
    if (action === 'PLAY_PAUSE' || action === 'SEEK') return hasControl.value;
    if (action === 'SKIP_SONG' || action === 'KICK_USER' || action === 'CHANGE_HOST') return true;
    return false;
  }
  return false;
};
export const canSeek = computed(() => hasPermission('SEEK'));

// Chat & Voting
export const chatMessages = ref<any[]>([]);
export const chatInput = ref('');
export const activeVote = ref<any>(null);
export const modeToast = ref<string>('');

// Player
export const lxEngines = ref<LxEngine[]>([]);
export const scriptLoaded = ref(false);
export const playMode = ref<'list-loop' | 'single-loop' | 'random'>('list-loop');
export const currentContext = ref<'search' | 'playlist' | 'room'>('search');
export const volume = ref(1);
export const duration = ref(0);
export const songQuality = ref('128k');
export const isLoadingUrl = ref(false);
export const isChangingSong = ref(false);
export const currentUrl = ref('');
export const isPlaying = ref(false);
export const currentTime = ref(0);
export const currentSong = ref<any>(null);
export const desiredPlaybackRate = ref(1);
export const audioRef = ref<HTMLAudioElement | null>(null);

export const lastAppliedSeq = ref(0);
export const pendingAfterLoad = ref<null | { targetTime: number; shouldPlay: boolean }>(null);

// Lyrics
export const lyrics = ref<{ time: number, text: string, tText?: string }[]>([]);
export const currentLyricIndex = ref(-1);

// Search
export const searchKeyword = ref('');
export const searchSource = ref('kw');
export const searchResults = ref<any[]>([]);
export const isSearching = ref(false);
export const searchPage = ref(1);
export const searchHasMore = ref(true);

// Playlists
export const playlist = ref<any[]>([]);
export const roomPlaylist = ref<any[]>([]);

// UI
export const activeTab = ref('room');
export const isMobilePlayerOpen = ref(false);
export const isMobileDrawerOpen = ref(false);
