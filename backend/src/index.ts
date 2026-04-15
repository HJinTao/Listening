import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import authRouter from './auth';
import playlistRouter from './playlist';

import searchRouter from './routes/search';
import lyricRouter from './routes/lyric';
import proxyRouter from './routes/proxy';
import musicUrlRouter from './routes/musicUrl';
import picRouter from './routes/pic';

import { setupSocket } from './socket';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/playlist', playlistRouter);
app.use('/api/search', searchRouter);
app.use('/api/lyric', lyricRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/url', musicUrlRouter);
app.use('/api/pic', picRouter);

// Serve built-in LXMUSIC scripts from the scripts directory
app.get('/api/scripts', (req, res) => {
  const scriptsDir = path.resolve(__dirname, '../scripts');
  try {
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
      return res.json([]);
    }
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    const scripts = files.map(f => {
      return fs.readFileSync(path.join(scriptsDir, f), 'utf-8');
    });
    res.json(scripts);
  } catch (error: any) {
    res.status(500).send('Failed to read scripts: ' + error.message);
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

setupSocket(io);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
