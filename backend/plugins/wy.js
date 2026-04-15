const axios = require('axios');

module.exports = {
  id: 'wy',
  name: '网易云音乐',
  search: async (keyword, page, limit) => {
    const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=${(page - 1) * limit}`;
    const resp = await axios.get(url);
    const data = resp.data;
    if (data && data.result && data.result.songs) {
      return {
        list: data.result.songs.map(item => ({
          name: item.name,
          singer: item.artists.map(a => a.name).join('、'),
          albumName: item.album ? item.album.name : '',
          albumId: item.album ? item.album.id : '',
          songmid: item.id,
          source: 'wy',
          interval: Math.floor(item.duration / 1000),
          pic: item.album && item.album.picUrl ? item.album.picUrl : ''
        }))
      };
    }
    return { list: [] };
  },
  getMusicUrl: async (songId, quality) => {
    const API_URL = "https://source.shiqianjiang.cn/api/music";
    const url = `${API_URL}/url?source=wy&songId=${songId}&quality=${quality}`;
    const resp = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "lx-music-request/2.0.0",
      },
    });
    if (resp.data && resp.data.code === 200) {
      return resp.data.url;
    }
    throw new Error(resp.data?.message || '获取URL失败');
  },
  getLyric: async (songId) => {
    const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
    const resp = await axios.get(url);
    let lyric = '';
    let tlyric = '';
    if (resp.data) {
      if (resp.data.lrc && resp.data.lrc.lyric) lyric = resp.data.lrc.lyric;
      if (resp.data.tlyric && resp.data.tlyric.lyric) tlyric = resp.data.tlyric.lyric;
    }
    return { lyric, tlyric };
  },
  getPic: async (songId, albumId) => {
    try {
      const url = `https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`;
      const resp = await axios.get(url);
      if (resp.data && resp.data.songs && resp.data.songs.length > 0) {
        return resp.data.songs[0].al?.picUrl || resp.data.songs[0].album?.picUrl || '';
      }
    } catch(e) {}
    return '';
  }
};
