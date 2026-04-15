import { Router } from 'express';
import PluginManager from '../services/PluginManager';

const router = Router();

router.get('/', async (req, res) => {
  const { songmid, source = 'kw', hash } = req.query;

  if (!songmid) {
    return res.status(400).json({ error: 'Songmid is required' });
  }

  try {
    const plugin = PluginManager.getPlugin(String(source));
    if (!plugin) {
      return res.status(404).json({ error: `Plugin for source ${source} not found` });
    }

    const mid = String(songmid);
    const extra = hash ? { hash: String(hash) } : undefined;
    
    const result = await plugin.getLyric(mid, extra);
    res.json({
      lyric: result?.lyric || '',
      tlyric: result?.tlyric || '',
    });
  } catch (error: any) {
    console.error('Lyric error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
