const axios = require('axios');

module.exports = {
  id: 'kg',
  name: '酷狗音乐',
  search: async (keyword, page, limit) => {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    const resp = await axios.get(url);
    const data = resp.data;
    if (data && data.data && data.data.lists) {
      return {
        list: data.data.lists.map(item => ({
          name: item.SongName,
          singer: item.SingerName,
          albumName: item.AlbumName,
          albumId: item.AlbumID,
          songmid: item.Audioid,
          hash: item.FileHash,
          source: 'kg',
          interval: item.Duration,
          pic: typeof item.Image === 'string' ? item.Image.replace('{size}', '400') : ''
        }))
      };
    }
    return { list: [] };
  },
  getMusicUrl: async (songId, quality) => {
    const API_URL = "https://source.shiqianjiang.cn/api/music";
    const url = `${API_URL}/url?source=kg&songId=${songId}&quality=${quality}`;
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
  getLyric: async (songId, extra) => {
    const hash = (extra && extra.hash) ? extra.hash : songId;
    const url = `https://m.kugou.com/app/i/krc.php?cmd=100&keyword=&hash=${hash}&timelength=999999&d=0.875`;
    const resp = await axios.get(url);
    let lyric = '';
    if (resp.data) {
      lyric = resp.data;
    }
    return { lyric, tlyric: '' };
  },
  getPic: async (songId, albumId, extra) => {
    const hash = (extra && extra.hash) ? extra.hash : songId;
    try {
      const url = 'http://media.store.kugou.com/v1/get_res_privilege';
      const resp = await axios.post(url, {
        appid: 1001,
        area_code: '1',
        behavior: 'play',
        clientver: '9020',
        need_hash_offset: 1,
        relate: 1,
        resource: [{
          album_audio_id: songId,
          album_id: albumId || '',
          hash: hash,
          id: 0,
          name: 'temp.mp3',
          type: 'audio'
        }],
        token: '',
        userid: 2626431536,
        vip: 1
      }, {
        headers: {
          'KG-RC': 1,
          'KG-THash': 'expand_search_manager.cpp:852736169:451',
          'User-Agent': 'KuGou2012-9020-ExpandSearchManager',
        }
      });
      if (resp.data && resp.data.data && resp.data.data[0] && resp.data.data[0].info) {
        let info = resp.data.data[0].info;
        const img = info.imgsize ? info.image.replace('{size}', info.imgsize[0]) : info.image;
        return img || '';
      }
    } catch (e) {
      console.error('KG getPic error:', e.message);
    }
    return '';
  }
};
