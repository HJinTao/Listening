import { Router } from 'express';
import PluginManager from '../services/PluginManager';

const router = Router();

router.get('/', async (req, res) => {
  const { source, songId, albumId, hash } = req.query;
  if (!source || !songId) {
    return res.status(400).json({ error: 'Source and songId are required' });
  }

  try {
    const plugin = PluginManager.getPlugin(String(source));
    if (!plugin) {
      return res.status(404).json({ error: `Plugin for source ${source} not found` });
    }

    const pic = await plugin.getPic(
      String(songId),
      albumId ? String(albumId) : '',
      hash ? { hash: String(hash) } : undefined,
    );
    return res.json({ pic: pic || '' });
  } catch (error: any) {
    console.error('Pic error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
