// server.js
// Minimal, production-safe Express + Socket.IO server for Railway

require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ---- Security & middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// Basic rate limiting (matches README vibe)
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ---- API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Placeholder endpoints (keep shape stable; fill in later as needed)
app.get('/api/players', (_req, res) => res.json([]));
app.get('/api/team', (_req, res) => res.json({}));
app.get('/api/roster', (_req, res) => res.json([]));
app.post('/api/draft', (_req, res) => res.json({ ok: true }));
app.get('/api/standings', (_req, res) => res.json([]));

// ---- Socket.IO events
io.on('connection', (socket) => {
  // Example events your README mentions
  socket.on('playerUpdate', (data) => {
    // broadcast to everyone (except sender) that a player updated
    socket.broadcast.emit('playerUpdate', data);
  });

  socket.on('playerDrafted', (data) => {
    io.emit('playerDrafted', data);
  });
});

// ---- Optional: serve a tiny landing so root URL shows something
app.get('/', (_req, res) => {
  res.type('html').send(`
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>College Fantasy Football API</title></head>
  <body style="font-family: system-ui; padding: 2rem;">
    <h1>College Fantasy Football API</h1>
    <p>Status: <code>/api/health</code></p>
  </body>
</html>
  `);
});

// ---- Start (Railway injects PORT)
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
