const axios = require('axios');

module.exports = {
  id: 'tx',
  name: 'QQ音乐',
  search: async (keyword, page, limit) => {
    const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    const resp = await axios.post(url, {
      comm: { ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic', platform: 'yqq.json' },
      req: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicMobile',
        param: { search_type: 0, query: keyword, page_num: page, num_per_page: limit }
      }
    }, {
      headers: { 'User-Agent': 'QQMusic 14090508(android 12)' }
    });
    const data = resp.data;
    if (data && data.req && data.req.data && data.req.data.body && data.req.data.body.item_song) {
      return {
        list: data.req.data.body.item_song.map(item => ({
          name: item.name,
          singer: item.singer.map(s => s.name).join('、'),
          albumName: item.album ? item.album.name : '',
          albumId: item.album ? item.album.mid : '',
          songmid: item.mid,
          source: 'tx',
          interval: item.interval,
          pic: item.album && item.album.mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg` : ''
        }))
      };
    }
    return { list: [] };
  },
  getMusicUrl: async (songId, quality) => {
    const API_URL = "https://source.shiqianjiang.cn/api/music";
    const url = `${API_URL}/url?source=tx&songId=${songId}&quality=${quality}`;
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
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songId}&format=json&nobase64=1`;
    const resp = await axios.get(url, {
      headers: { 'Referer': 'https://y.qq.com/' }
    });
    let lyric = '';
    let tlyric = '';
    if (resp.data) {
      if (resp.data.lyric) lyric = resp.data.lyric;
      if (resp.data.trans) tlyric = resp.data.trans;
    }
    return { lyric, tlyric };
  },
  getPic: async (songId, albumId) => {
    if (albumId) {
      return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`;
    }
    return '';
  }
};
