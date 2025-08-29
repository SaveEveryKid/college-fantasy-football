// server.js
// A minimal HTTP server for a simple college fantasy football draft demo.
//
// This implementation avoids external dependencies like Express or Socket.IO.
// It uses Node.js built‑in modules to serve static files, provide JSON APIs
// and implement basic server‑sent events (SSE) for real‑time notifications.

const fs = require("fs");
const http = require("http");
const path = require("path");

// Load .env if available (optional)
try {
  require("dotenv").config();
} catch (_) {
  /* ignore if dotenv is not installed */
}

// Load players from a JSON file
const players = JSON.parse(
  fs.readFileSync(path.join(__dirname, "players.json"), "utf8")
);

// Track drafted players in a Set
const drafted = new Set();

// Connected SSE clients
const sseClients = [];

// Broadcast an SSE event to all clients
function broadcastEvent(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(message);
    } catch (_) {
      sseClients.splice(i, 1);
    }
  }
}

// Read a static file from /public or root
function tryReadStatic(filepath) {
  const publicDir = path.join(__dirname, "public");
  let fullPath = path.join(publicDir, filepath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fs.readFileSync(fullPath);
  }
  fullPath = path.join(__dirname, filepath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fs.readFileSync(fullPath);
  }
  return null;
}

// Determine content type for static files
function getContentType(ext) {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // Health check
  if (pathname === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  // List available (undrafted) players
  if (pathname === "/api/players" && req.method === "GET") {
    const available = players.filter((p) => !drafted.has(p.id));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(available));
    return;
  }

  // List drafted players (your roster)
  if (pathname === "/api/roster" && req.method === "GET") {
    const roster = players.filter((p) => drafted.has(p.id));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(roster));
    return;
  }

  // Draft a player
  if (pathname === "/api/draft" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) req.socket.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const id = Number(data.playerId);
        const player = players.find((p) => p.id === id);
        if (!player) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid player ID" }));
          return;
        }
        if (drafted.has(id)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Player already drafted" }));
          return;
        }
        drafted.add(id);
        broadcastEvent("draft", { id });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // SSE endpoint for real‑time draft updates
  if (pathname === "/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 10000\n\n");
    sseClients.push(res);
    req.on("close", () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
    return;
  }

  // Simple standings endpoint (sum of player ratings)
  if (pathname === "/api/standings" && req.method === "GET") {
    const total = Array.from(drafted).reduce((sum, id) => {
      const p = players.find((pl) => pl.id === id);
      return sum + (p ? p.rating : 0);
    }, 0);
    const standings = [{ teamName: "Your Team", points: total }];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(standings));
    return;
  }

  // Serve static files
  if (req.method === "GET") {
    let filePath = pathname === "/" ? "/index.html" : pathname;
    const data = tryReadStatic(filePath);
    if (data) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": getContentType(ext) });
      res.end(data);
      return;
    }
    const indexData = tryReadStatic("/index.html");
    if (indexData) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(indexData);
      return;
    }
  }

  // 404 fallback
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
