import { Router } from 'express';
import axios from 'axios';

const router = Router();

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m < 10 ? '0' + m : m}:${Number(s) < 10 ? '0' + s : s}`;
}

router.get('/', async (req, res) => {
  const { songmid, source = 'kw', hash } = req.query;

  if (!songmid) {
    return res.status(400).json({ error: 'Songmid is required' });
  }

  try {
    let lyric = '';
    const mid = String(songmid);

    switch (source) {
      case 'kw': {
        const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${mid}`;
        const resp = await axios.get(url);
        if (resp.data && resp.data.data && resp.data.data.lrclist) {
          lyric = resp.data.data.lrclist.map((l: any) => `[${formatTime(l.time)}]${l.lineLyric}`).join('\n');
        }
        break;
      }
      case 'kg': {
        const kgHash = hash ? String(hash) : mid;
        const url = `https://m.kugou.com/app/i/krc.php?cmd=100&keyword=&hash=${kgHash}&timelength=999999&d=0.875`;
        const resp = await axios.get(url);
        if (resp.data) {
          lyric = resp.data;
        }
        break;
      }
      case 'wy': {
        const url = `https://music.163.com/api/song/lyric?id=${mid}&lv=1&kv=1&tv=-1`;
        const resp = await axios.get(url);
        if (resp.data && resp.data.lrc) {
          lyric = resp.data.lrc.lyric;
        }
        break;
      }
      case 'tx': {
        const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${mid}&format=json&nobase64=1`;
        const resp = await axios.get(url, {
          headers: { 'Referer': 'https://y.qq.com/' }
        });
        if (resp.data && resp.data.lyric) {
          lyric = resp.data.lyric;
        }
        break;
      }
    }

    res.json({ lyric });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;