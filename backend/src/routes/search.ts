import { Router } from 'express';
import PluginManager from '../services/PluginManager';

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
    const preferredSource = String(source);

    const allPlugins = PluginManager.getAllPlugins();
    if (allPlugins.length === 0) {
      return res.status(500).json({ error: 'No plugins available' });
    }

    // Sort plugins so the preferred source is first
    const sortedPlugins = [
      ...allPlugins.filter(p => p.id === preferredSource),
      ...allPlugins.filter(p => p.id !== preferredSource)
    ];

    for (const plugin of sortedPlugins) {
      try {
        const results = await plugin.search(kw, p, l);
        if (results && results.list && results.list.length > 0) {
          const normalizedList = results.list.map((item: any) => ({
            ...item,
            source: item.source || plugin.id,
            albumId: item.albumId || '',
            pic: item.pic || '',
          }));
          return res.json({ list: normalizedList, currentSource: plugin.id });
        }
      } catch (e: any) {
        console.error(`Search failed for plugin ${plugin.id}:`, e.message);
        // Continue to the next plugin on error
      }
    }

    // All plugins failed or returned empty results
    return res.json({ list: [] });
  } catch (error: any) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
