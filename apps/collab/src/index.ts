import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "./config.js";
import { verifyToken } from "./auth.js";
import { resolveDocumentRole, closePool } from "./db.js";
import { Room } from "./room.js";

const rooms = new Map<string, Room>();

function getRoom(documentId: string): Room {
  let room = rooms.get(documentId);
  if (!room) {
    room = new Room(documentId);
    rooms.set(documentId, room);
  }
  return room;
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "collab", rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token") ?? "";
    const documentId = url.searchParams.get("doc") ?? "";

    console.log(`[collab] upgrade request for doc=${documentId?.slice(0, 8)}… token=${token ? "present" : "missing"}`);

    const identity = verifyToken(token);
    if (!identity || !documentId) {
      console.log(`[collab] rejected: ${!identity ? "invalid token" : "missing doc id"}`);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const role = await resolveDocumentRole(identity.userId, documentId);
    if (!role) {
      console.log(`[collab] rejected: user ${identity.email} has no access to doc ${documentId.slice(0, 8)}…`);
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const canWrite = role === "owner" || role === "editor";
    console.log(`[collab] accepted: ${identity.email} → doc ${documentId.slice(0, 8)}… (${role}, write=${canWrite})`);
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, documentId, canWrite);
    });
  } catch (err) {
    console.error("[collab] upgrade error", err);
    socket.destroy();
  }
});

wss.on("connection", async (ws: WebSocket, documentId: string, canWrite: boolean) => {
  const room = getRoom(documentId);
  await room.ensureLoaded();
  room.addConnection(ws, canWrite);
});

// Periodically evict empty rooms to free memory.
setInterval(() => {
  for (const [id, room] of rooms) {
    if (room.isEmpty) rooms.delete(id);
  }
}, 60_000);

server.listen(config.port, () => {
  console.log(`Synapse collab service listening on ws://localhost:${config.port}`);
});

async function shutdown() {
  console.log("Shutting down collab service...");
  wss.close();
  server.close();
  await closePool();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
