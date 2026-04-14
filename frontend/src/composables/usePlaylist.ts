import axios from 'axios';
import { backendUrl, playlist, roomPlaylist, socket, roomId, isLoggedIn } from '../store/state';
import { i18n } from '../i18n';

export function usePlaylist() {
  const t = i18n.global.t;

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

  const addToRoomPlaylist = (song: any) => {
    if (socket.value) {
      const trackId = song.songmid || song.hash || song.id;
      if (roomPlaylist.value.some(s => (s.songmid || s.hash || s.id) === trackId)) {
        alert(t('app.songAlreadyInPlaylist'));
        return;
      }
      socket.value.emit('add-song', { roomId: Number(roomId.value), song });
    }
  };

  const removeSong = (index: number) => {
    if (socket.value) {
      socket.value.emit('remove-song', { roomId: Number(roomId.value), index });
    }
  };

  return {
    fetchPlaylist,
    isInPlaylist,
    togglePlaylist,
    addToRoomPlaylist,
    removeSong
  };
}