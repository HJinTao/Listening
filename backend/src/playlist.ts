import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_listening_key_123';

// Auth Middleware
const auth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(auth);

// Get playlist
router.get('/', (req: any, res: any) => {
  try {
    const rows = db.prepare('SELECT * FROM playlist WHERE user_id = ? ORDER BY id DESC').all(req.user.id) as any[];
    const list = rows.map(r => JSON.parse(r.song_data));
    res.json({ list });
  } catch (error: any) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to playlist
router.post('/', (req: any, res: any) => {
  const { song } = req.body;
  if (!song || (!song.songmid && !song.hash)) {
    return res.status(400).json({ error: 'Invalid song data' });
  }

  const trackId = song.songmid || song.hash || song.id;

  try {
    const existing = db.prepare('SELECT id FROM playlist WHERE user_id = ? AND songmid = ?').get(req.user.id, trackId);
    if (existing) {
      return res.json({ message: 'Song already in playlist' });
    }

    db.prepare('INSERT INTO playlist (user_id, songmid, song_data) VALUES (?, ?, ?)')
      .run(req.user.id, trackId, JSON.stringify(song));
    
    res.json({ message: 'Added to playlist' });
  } catch (error: any) {
    console.error('Add to playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from playlist
router.delete('/:songmid', (req: any, res: any) => {
  const { songmid } = req.params;
  try {
    db.prepare('DELETE FROM playlist WHERE user_id = ? AND songmid = ?').run(req.user.id, songmid);
    res.json({ message: 'Removed from playlist' });
  } catch (error: any) {
    console.error('Remove from playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
