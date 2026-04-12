import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import authRouter from './auth';
import playlistRouter from './playlist';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/playlist', playlistRouter);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Serve built-in LXMUSIC script
app.get('/api/script', (req, res) => {
  const scriptPath = path.join(__dirname, '../LXMUSIC.js');
  try {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    res.send(content);
  } catch (error: any) {
    res.status(500).send('Failed to read script: ' + error.message);
  }
});

// Search API
app.get('/api/search', async (req, res) => {
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

// Lyric API
app.get('/api/lyric', async (req, res) => {
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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m < 10 ? '0' + m : m}:${Number(s) < 10 ? '0' + s : s}`;
}

// Proxy API for LXMUSIC script to bypass CORS
app.post('/api/proxy', async (req, res) => {
  const { url, method = 'GET', headers, body } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios({
      url,
      method,
      headers: {
        ...headers,
        // Remove headers that might cause issues when proxied
        host: undefined,
        origin: undefined,
        referer: undefined,
      },
      data: body,
      validateStatus: () => true, // resolve all status codes
    });

    res.status(response.status).json({
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: response.headers,
      body: response.data,
    });
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Music URL API (Integrated from KUN.js)
app.get('/api/url', async (req, res) => {
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

// Room logic
interface User {
  id: string;
  username: string;
  roomId: number;
  isHost: boolean;
  canControl?: boolean;
}

const users = new Map<string, User>();
const roomPlaylists = new Map<number, any[]>();

type SyncCommand = {
  authorityId: string;
  seq: number;
  sentAt: number;
  type: string;
  payload?: any;
};

type PlayerSnapshot = {
  authorityId: string;
  seq: number;
  sentAt: number;
  url: string;
  isPlaying: boolean;
  position: number;
  songInfo?: any;
  playMode?: string;
};

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_listening_key_123';

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (socket as any).user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', ({ roomId }) => {
    const numRoomId = Number(roomId);
    if (isNaN(numRoomId)) return;

    const username = (socket as any).user.username;

    // Check if room exists to assign host
    const existingUsers = Array.from(users.values()).filter(u => u.roomId === numRoomId);

    // Reject duplicate join
    if (existingUsers.some(u => u.username === username)) {
      socket.emit('join-error', { message: '您已在房间中，无法重复加入' });
      return;
    }

    socket.join(String(numRoomId));
    
    const isHost = existingUsers.length === 0;

    const user = { id: socket.id, username, roomId: numRoomId, isHost };
    users.set(socket.id, user);
    
    if (!roomPlaylists.has(numRoomId)) {
      roomPlaylists.set(numRoomId, []);
    }

    // Broadcast user joined
    io.to(String(numRoomId)).emit('chat-message', {
      sender: 'System',
      message: `${username} 加入了房间`,
      isSystem: true,
    });

    // Send room info to everyone
    io.to(String(numRoomId)).emit('room-info', {
      users: Array.from(users.values()).filter(u => u.roomId === numRoomId),
      playlist: roomPlaylists.get(numRoomId),
    });
  });

  socket.on('chat-message', ({ roomId, message }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (user && user.roomId === numRoomId) {
      io.to(String(numRoomId)).emit('chat-message', {
        sender: user.username,
        message,
        isSystem: false,
      });
    }
  });

  socket.on('add-song', ({ roomId, song }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || user.roomId !== numRoomId) return;
    
    const pl = roomPlaylists.get(numRoomId) || [];
    // 标记是谁点的歌
    song.requesterId = user.id;
    song.requesterName = user.username;
    pl.push(song);
    roomPlaylists.set(numRoomId, pl);
    
    io.to(String(numRoomId)).emit('room-playlist', pl);
    io.to(String(numRoomId)).emit('chat-message', {
      sender: 'System',
      message: `${user.username} 点了歌曲: ${song.name}`,
      isSystem: true,
    });
  });

  socket.on('remove-song', ({ roomId, index }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || (!user.isHost && !user.canControl) || user.roomId !== numRoomId) return;
    
    const pl = roomPlaylists.get(numRoomId) || [];
    if (index >= 0 && index < pl.length) {
      pl.splice(index, 1);
      roomPlaylists.set(numRoomId, pl);
      io.to(String(numRoomId)).emit('room-playlist', pl);
    }
  });

  socket.on('clear-playlist', ({ roomId }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || (!user.isHost && !user.canControl) || user.roomId !== numRoomId) return;
    
    roomPlaylists.set(numRoomId, []);
    io.to(String(numRoomId)).emit('room-playlist', []);
  });

  socket.on('sync-command', ({ roomId, command }: { roomId: number; command: SyncCommand }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || user.roomId !== numRoomId) return;
    if (!command || typeof command.seq !== 'number' || typeof command.sentAt !== 'number' || typeof command.type !== 'string') return;

    let hasPermission = user.isHost || user.canControl;
    if (!hasPermission && command.type === 'SEEK' && command.payload?.trackId) {
      const pl = roomPlaylists.get(numRoomId) || [];
      const song = pl.find((s: any) => (s.songmid || s.hash || s.id) === command.payload.trackId);
      if (song && song.requesterId === user.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) return;

    if (command.type === 'SET_TRACK' && command.payload?.songInfo) {
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: `${user.username} 切歌: ${command.payload.songInfo.name}`,
        isSystem: true,
      });
    } else if (command.type === 'CHANGE_MODE') {
      const modeNames: Record<string, string> = {
        'list-loop': '列表循环',
        'single-loop': '单曲循环',
        'random': '随机播放'
      };
      const modeName = modeNames[command.payload?.mode] || command.payload?.mode;
      io.to(String(numRoomId)).emit('chat-message', {
        sender: 'System',
        message: `${user.username} 将播放模式更改为: ${modeName}`,
        isSystem: true,
      });
    }

    const forwarded: SyncCommand = { ...command, authorityId: socket.id };
    socket.to(String(numRoomId)).emit('sync-command', forwarded);
  });

  socket.on('request-state', ({ roomId }: { roomId: number }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || user.roomId !== numRoomId) return;

    const host = Array.from(users.values()).find(u => u.roomId === numRoomId && u.isHost);
    if (!host) return;
    io.to(host.id).emit('request-state', { roomId: numRoomId, fromUserId: socket.id });
  });

  socket.on('state-response', ({ roomId, toUserId, snapshot }: { roomId: number; toUserId: string; snapshot: PlayerSnapshot }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (!user || !user.isHost || user.roomId !== numRoomId) return;

    const targetUser = users.get(toUserId);
    if (!targetUser || targetUser.roomId !== numRoomId) return;
    if (!snapshot || typeof snapshot.seq !== 'number' || typeof snapshot.sentAt !== 'number' || typeof snapshot.url !== 'string') return;

    const forwarded: PlayerSnapshot = { ...snapshot, authorityId: socket.id };
    io.to(toUserId).emit('state-response', { roomId: numRoomId, snapshot: forwarded });
  });
  
  socket.on('pass-host', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = users.get(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        user.isHost = false;
        targetUser.isHost = true;
        targetUser.canControl = true;
        io.to(String(numRoomId)).emit('room-info', {
          users: Array.from(users.values()).filter(u => u.roomId === numRoomId),
          playlist: roomPlaylists.get(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: `${user.username} 将房主转移给了 ${targetUser.username}`,
          isSystem: true,
        });
      }
    }
  });

  socket.on('grant-control', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = users.get(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        targetUser.canControl = true;
        io.to(String(numRoomId)).emit('room-info', {
          users: Array.from(users.values()).filter(u => u.roomId === numRoomId),
          playlist: roomPlaylists.get(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: `${user.username} 赋予了 ${targetUser.username} 控制权`,
          isSystem: true,
        });
      }
    }
  });

  socket.on('revoke-control', ({ roomId, targetUserId }) => {
    const numRoomId = Number(roomId);
    const user = users.get(socket.id);
    if (user && user.isHost && user.roomId === numRoomId) {
      const targetUser = users.get(targetUserId);
      if (targetUser && targetUser.roomId === numRoomId) {
        targetUser.canControl = false;
        io.to(String(numRoomId)).emit('room-info', {
          users: Array.from(users.values()).filter(u => u.roomId === numRoomId),
          playlist: roomPlaylists.get(numRoomId),
        });
        io.to(String(numRoomId)).emit('chat-message', {
          sender: 'System',
          message: `${user.username} 撤销了 ${targetUser.username} 的控制权`,
          isSystem: true,
        });
      }
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { roomId, username, isHost } = user;
      users.delete(socket.id);
      socket.leave(String(roomId));

      io.to(String(roomId)).emit('chat-message', {
        sender: 'System',
        message: `${username} 离开了房间`,
        isSystem: true,
      });

      const remainingUsers = Array.from(users.values()).filter(u => u.roomId === roomId);
      if (remainingUsers.length === 0) {
      } else if (isHost && remainingUsers[0]) {
        // Pass host to someone else
        remainingUsers[0].isHost = true;
        io.to(String(roomId)).emit('chat-message', {
          sender: 'System',
          message: `${remainingUsers[0].username} 成为房主`,
          isSystem: true,
        });
      }

      if (remainingUsers.length > 0) {
        io.to(String(roomId)).emit('room-info', {
          users: remainingUsers,
        });
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('ping-time', (clientTime: number) => {
    socket.emit('pong-time', { clientTime, serverTime: Date.now() });
  });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = 3000; // 强制在此服务器的特定端口 3000 上运行
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
