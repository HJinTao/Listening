import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req, res) => {
  const { source, songId, quality = '128k' } = req.query;

  if (!source || !songId) {
    return res.status(400).json({ error: 'Source and songId are required' });
  }

  try {
    const API_URL = "http://api.ikunshare.com";
    const API_KEY = "";
    
    const url = `${API_URL}/url?source=${source}&songId=${songId}&quality=${quality}`;
    const resp = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "lx-music-request/2.0.0",
        "X-Request-Key": API_KEY,
      },
    });

    const body = resp.data;
    if (!body || isNaN(Number(body.code))) {
      return res.status(500).json({ error: 'unknow error' });
    }

    switch (body.code) {
      case 200:
        return res.json({ url: body.url });
      case 403:
        return res.status(403).json({ error: 'Key失效/鉴权失败' });
      case 500:
        return res.status(500).json({ error: `获取URL失败, ${body.message ?? '未知错误'}` });
      case 429:
        return res.status(429).json({ error: '请求过速' });
      default:
        return res.status(500).json({ error: body.message ?? '未知错误' });
    }
  } catch (error: any) {
    console.error('Music URL error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;