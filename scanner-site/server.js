import http from "http";
import { WebSocketServer } from "ws";
import { readFileSync, existsSync } from "fs";
import { extname, join } from "path";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const PUBLIC_DIR = join(process.cwd(), "public");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  // 쿼리 파라미터 제거
  const urlPath = req.url === "/" ? "/wall.html" : req.url.split("?")[0];
  
  // favicon.ico 요청은 무시
  if (urlPath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const filePath = join(PUBLIC_DIR, urlPath);

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  res.end(readFileSync(filePath));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (buf) => {
    const msg = buf.toString();
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  console.log(`Wall:    http://localhost:${PORT}/wall.html`);
  console.log(`Control: http://localhost:${PORT}/control.html`);
});
