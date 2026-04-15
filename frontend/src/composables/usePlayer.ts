import axios from 'axios';
import { nextTick } from 'vue';
import { i18n } from '../i18n';
import { 
  backendUrl, audioRef, currentUrl, isPlaying, currentTime, duration, 
  currentSong, lyrics, currentLyricIndex, playMode,
  songQuality, isLoadingUrl, isChangingSong, lastAppliedSeq, 
  pendingAfterLoad, desiredPlaybackRate, socket, roomId, hasControl, 
  canSeek, getSyncedTime, users, hasPermission, roomMode,
  hostUserId, roomPlaylist, searchResults, playlist, currentContext, lxEngines
} from '../store/state';
import { useRoom } from './useRoom';

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

export function usePlayer() {
  const t = i18n.global.t;
  const { initiateVote } = useRoom();

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
    
    // Do not apply drift correction if the audio is actively buffering
    if (audio.readyState > 0 && audio.readyState < 3) return;
    
    const diff = targetTime - audio.currentTime;

    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (playing) {
      if (Math.abs(diff) > 1.5) {
        ensurePlaybackRate(1);
        audio.currentTime = targetTime;
        return;
      }
      
      if (isMobileBrowser) {
        ensurePlaybackRate(1);
        // Only jump if the drift is large enough to be noticeable, to avoid constant stuttering
        if (Math.abs(diff) > 1.0) {
          audio.currentTime = targetTime;
        }
        return;
      }

      if (Math.abs(diff) > 0.05) {
        const rate = clamp(1 + diff * 0.4, 0.85, 1.15);
        ensurePlaybackRate(rate);
      } else {
        ensurePlaybackRate(1);
      }
      return;
    }
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
    
    let userHasPermission = senderUser.isHost || senderUser.canControl;
    if (!userHasPermission && command.type === 'SEEK' && command.payload?.trackId) {
      const song = roomPlaylist.value.find(s => (s.songmid || s.hash || s.id) === command.payload!.trackId);
      if (song && song.requesterId === senderUser.id) {
        userHasPermission = true;
      }
    }
    if (!userHasPermission) return;

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

  const playSong = async (song: any, context?: 'search' | 'playlist' | 'room') => {
    if (!hasPermission('SKIP_SONG')) {
      alert(t('app.notHost'));
      return;
    }
    if (roomMode.value === 'democracy' && !hasControl.value) {
      initiateVote('SKIP_SONG');
      alert(t('app.cannotSkipDemocracy'));
      return;
    }
    if (!hasControl.value) return;
    if (context) {
      currentContext.value = context;
    }
    if (lxEngines.value.length === 0) return;
    isLoadingUrl.value = true;
    isChangingSong.value = true;
    try {
      const musicInfo = { 
        songmid: song.songmid, 
        hash: song.hash || song.songmid,
        name: song.name,
        singer: song.singer 
      };
      
      let response: any = null;
      for (const engine of lxEngines.value) {
        if (!engine.isInited) continue;
        try {
          response = await engine.requestMusicUrl(song.source, musicInfo, songQuality.value);
          if (response) {
            break;
          }
        } catch (err) {
          console.warn('Engine failed to get URL, trying next...', err);
        }
      }
      
      if (!response) {
        throw new Error('All engines failed to get music URL');
      }
      
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

  const fetchLyrics = async (song: any) => {
    lyrics.value = [{ time: 0, text: t('app.loadingLyrics'), tText: '' }];
    currentLyricIndex.value = -1;
    try {
      const resp = await axios.get(`${backendUrl}/api/lyric`, {
        params: { songmid: song.songmid, source: song.source, hash: song.hash }
      });
      if (resp.data.lyric) {
        parseLrc(resp.data.lyric, resp.data.tlyric || '');
      } else {
        lyrics.value = [{ time: 0, text: t('app.noLyrics'), tText: '' }];
      }
    } catch (error) {
      console.error('Failed to fetch lyrics:', error);
      lyrics.value = [{ time: 0, text: t('app.fetchLyricsFailed'), tText: '' }];
    }
  };

  const parseSingleLrc = (lrc: string) => {
    const lines = lrc.split('\n');
    const result: { time: number, text: string }[] = [];
    const timeExp = /\[(\d{2,}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
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
    return result.sort((a, b) => a.time - b.time);
  };

  const parseLrc = (lrc: string, tlyric = '') => {
    const main = parseSingleLrc(lrc);
    const translated = tlyric ? parseSingleLrc(tlyric) : [];

    if (main.length === 0) {
      lyrics.value = [{ time: 0, text: t('app.noLyrics'), tText: '' }];
      return;
    }

    if (translated.length === 0) {
      lyrics.value = main.map(line => ({ ...line, tText: '' }));
      return;
    }

    const tMap = new Map<string, string>();
    for (const line of translated) {
      tMap.set(line.time.toFixed(3), line.text);
    }

    lyrics.value = main.map(line => ({
      ...line,
      tText: tMap.get(line.time.toFixed(3)) || '',
    }));
  };

  const updateLyricIndex = (currentTime: number, lyricScrollRef: HTMLElement | null) => {
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
      if (lyricScrollRef && index !== -1) {
        const activeEl = lyricScrollRef.children[index] as HTMLElement;
        if (activeEl) {
          lyricScrollRef.scrollTo({
            top: activeEl.offsetTop - lyricScrollRef.offsetHeight / 2 + activeEl.offsetHeight / 2,
            behavior: 'smooth'
          });
        }
      }
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
    updateLyricIndex(audioRef.value.currentTime, null);
    currentTime.value = audioRef.value.currentTime;
  };
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
  const onEnded = () => {
    if (!hasControl.value) return;
    playNextSong(false);
  };

  return {
    applySyncCommand,
    buildSnapshot,
    applySnapshot,
    playSong,
    playNextSong,
    playPrevSong,
    togglePlayPause,
    togglePlayMode,
    seekTo,
    formatTime,
    sendSyncCommand,
    fetchLyrics,
    parseLrc,
    updateLyricIndex,
    getTrackId,
    ensurePlaybackRate,
    onPlay,
    onPause,
    onSeeked,
    onSeeking,
    onRateChange,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
    hasPermission
  };
}
