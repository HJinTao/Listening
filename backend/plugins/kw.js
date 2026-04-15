const axios = require('axios');

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m < 10 ? '0' + m : m}:${Number(s) < 10 ? '0' + s : s}`;
}

module.exports = {
  id: 'kw',
  name: '酷我音乐',
  search: async (keyword, page, limit) => {
    const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`;
    const resp = await axios.get(url);
    const data = resp.data;
    if (data && data.abslist) {
      return {
        list: data.abslist.map(info => ({
          name: info.SONGNAME,
          singer: info.ARTIST,
          albumName: info.ALBUM,
          albumId: info.ALBUMID || '',
          songmid: info.MUSICRID.replace('MUSIC_', ''),
          source: 'kw',
          interval: info.DURATION,
          pic: info.web_albumpic_short || info.hts_img || ''
        }))
      };
    }
    return { list: [] };
  },
  getMusicUrl: async (songId, quality) => {
    const API_URL = "https://source.shiqianjiang.cn/api/music";
    const url = `${API_URL}/url?source=kw&songId=${songId}&quality=${quality}`;
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
    const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${songId}`;
    const resp = await axios.get(url);
    let lyric = '';
    if (resp.data && resp.data.data && resp.data.data.lrclist) {
      lyric = resp.data.data.lrclist.map(l => `[${formatTime(l.time)}]${l.lineLyric}`).join('\n');
    }
    return { lyric, tlyric: '' };
  },
  getPic: async (songId) => {
    try {
      const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${songId}`;
      const resp = await axios.get(url);
      if (resp.data && resp.data.data && resp.data.data.songinfo) {
        return resp.data.data.songinfo.pic || '';
      }
    } catch(e) {}
    return '';
  }
};
