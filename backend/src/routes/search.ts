import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req, res) => {
  const { keyword, source = 'kw', page = 1, limit = 20 } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    const kw = String(keyword);
    const p = Number(page);
    const l = Number(limit);

    // 定义支持的音源及其顺序，将用户请求的音源放在第一位
    const allSources = ['kw', 'kg', 'tx', 'wy'];
    const searchSources = [
      String(source),
      ...allSources.filter(s => s !== String(source))
    ];

    for (const currentSource of searchSources) {
      let results: any = [];
      try {
        switch (currentSource) {
          case 'kw': {
            const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(kw)}&pn=${p - 1}&rn=${l}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`;
            const resp = await axios.get(url);
            const data = resp.data;
            if (data && data.abslist) {
              results = data.abslist.map((info: any) => ({
                name: info.SONGNAME,
                singer: info.ARTIST,
                albumName: info.ALBUM,
                songmid: info.MUSICRID.replace('MUSIC_', ''),
                source: 'kw',
                interval: info.DURATION,
              }));
            }
            break;
          }
          case 'kg': {
            const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(kw)}&page=${p}&pagesize=${l}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
            const resp = await axios.get(url);
            const data = resp.data;
            if (data && data.data && data.data.lists) {
              results = data.data.lists.map((item: any) => ({
                name: item.SongName,
                singer: item.SingerName,
                albumName: item.AlbumName,
                songmid: item.Audioid,
                hash: item.FileHash,
                source: 'kg',
                interval: item.Duration,
              }));
            }
            break;
          }
          case 'tx': {
            const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
            const resp = await axios.post(url, {
              comm: { ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic', platform: 'yqq.json' },
              req: {
                module: 'music.search.SearchCgiService',
                method: 'DoSearchForQQMusicMobile',
                param: { search_type: 0, query: kw, page_num: p, num_per_page: l }
              }
            }, {
              headers: { 'User-Agent': 'QQMusic 14090508(android 12)' }
            });
            const data = resp.data;
            if (data && data.req && data.req.data && data.req.data.body && data.req.data.body.item_song) {
              results = data.req.data.body.item_song.map((item: any) => ({
                name: item.name,
                singer: item.singer.map((s: any) => s.name).join('、'),
                albumName: item.album ? item.album.name : '',
                songmid: item.mid,
                source: 'tx',
                interval: item.interval,
              }));
            }
            break;
          }
          case 'wy': {
            const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(kw)}&type=1&limit=${l}&offset=${(p - 1) * l}`;
            const resp = await axios.get(url);
            const data = resp.data;
            if (data && data.result && data.result.songs) {
              results = data.result.songs.map((item: any) => ({
                name: item.name,
                singer: item.artists.map((a: any) => a.name).join('、'),
                albumName: item.album ? item.album.name : '',
                songmid: item.id,
                source: 'wy',
                interval: Math.floor(item.duration / 1000),
              }));
            }
            break;
          }
        }
        
        // 如果当前音源搜索结果不为空，则返回结果
        if (results && results.length > 0) {
          return res.json({ list: results, currentSource });
        }
      } catch (e: any) {
        console.error(`Search failed for source ${currentSource}:`, e.message);
        // 如果出错，则继续循环尝试下一个音源
      }
    }

    // 所有音源都尝试过，依然为空
    return res.json({ list: [] });
  } catch (error: any) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;