import axios from 'axios';
import { backendUrl } from '../store/state';

const PIC_CACHE_KEY = 'listening_pic_cache';

function getCache() {
  try {
    const raw = localStorage.getItem(PIC_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setCache(cache: any) {
  try {
    localStorage.setItem(PIC_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

export async function getOrFetchPic(song: any): Promise<string> {
  if (song.pic) return song.pic;
  
  const songId = song.songmid || song.hash || song.id;
  if (!songId) return '';
  
  const cacheKey = `${song.source}_${songId}`;
  const cache = getCache();
  
  if (cache[cacheKey]) {
    song.pic = cache[cacheKey];
    return cache[cacheKey];
  }
  
  try {
    const resp = await axios.get(`${backendUrl}/api/pic`, {
      params: { source: song.source, songId }
    });
    if (resp.data?.pic) {
      song.pic = resp.data.pic;
      cache[cacheKey] = song.pic;
      setCache(cache);
      return song.pic;
    }
  } catch (e) {
    console.error('Fetch pic failed:', e);
  }
  
  return '';
}

export function populatePics(songs: any[]) {
  songs.forEach(song => {
    if (!song.pic) {
      getOrFetchPic(song);
    }
  });
}
