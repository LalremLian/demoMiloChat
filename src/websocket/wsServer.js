const { WebSocketServer } = require('ws');
const { authenticateWsConnection } = require('./wsAuth');
const { handleMessage, handleConnect, handleDisconnect } = require('./wsHandler');

/**
 * Attaches a WebSocket server to an existing HTTP server instance.
 *
 * Connection flow:
 *   1. Client connects to ws://host/ws?token=<jwt>
 *   2. Server verifies the JWT on the 'upgrade' event — rejects with 401 if invalid
 *   3. On success, the socket is registered in the wsClients map and stored on the app
 *   4. Incoming messages are routed through wsHandler
 *   5. On disconnect, presence is updated and user_offline is broadcast
 *
 * The wsClients map (userId → WebSocket) is attached to the Express app so
 * controllers can reach connected clients without a separate import.
 *
 * @param {import('http').Server} httpServer
 * @param {import('express').Application} app
 */
const initWebSocketServer = (httpServer, app) => {
  // In-memory map: userId (string) → WebSocket instance
  const wsClients = new Map();
  app.set('wsClients', wsClients);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    // Authentication happens in the 'upgrade' event — do not verify here
    verifyClient: () => true,
  });

  // ── Authenticate on upgrade (before the socket is established) ────────────
  httpServer.on('upgrade', async (req, socket, head) => {
    // Only handle our /ws path
    if (!req.url.startsWith('/ws')) return;

    try {
      const user = await authenticateWsConnection(req);
      // Stash the user on the request object so the 'connection' handler can read it
      req._wsUser = user;
      // Let the WebSocketServer proceed with the handshake
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (err) {
      const status = err.statusCode || 401;
      const body = JSON.stringify({ success: false, message: err.message, code: status });
      socket.write(
        `HTTP/1.1 ${status} ${status === 401 ? 'Unauthorized' : 'Forbidden'}\r\n` +
          'Content-Type: application/json\r\n' +
          `Content-Length: ${Buffer.byteLength(body)}\r\n` +
          'Connection: close\r\n\r\n' +
          body
      );
      socket.destroy();
    }
  });

  // ── Handle established connections ────────────────────────────────────────
  wss.on('connection', (ws, req) => {
    const user = req._wsUser;
    if (!user) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const userId = user._id.toString();

    // Replace any stale connection for this user (e.g. reconnect)
    const existing = wsClients.get(userId);
    if (existing && existing.readyState === 1 /* OPEN */) {
      existing.close(1001, 'Replaced by new connection');
    }
    wsClients.set(userId, ws);

    console.log(`[WS] Connected: ${user.username} (${userId})`);

    // Broadcast user_online and update DB
    handleConnect(user, wsClients).catch(() => {});

    // ── Incoming message ───────────────────────────────────────────────────
    ws.on('message', (rawMessage) => {
      handleMessage(ws, user, rawMessage, wsClients).catch((err) => {
        console.error(`[WS] Message handler error for ${userId}:`, err.message);
      });
    });

    // ── Ping/pong keepalive ────────────────────────────────────────────────
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    ws.on('close', () => {
      // Only remove from map if this is still the active socket for the user
      if (wsClients.get(userId) === ws) {
        wsClients.delete(userId);
      }
      console.log(`[WS] Disconnected: ${user.username} (${userId})`);
      handleDisconnect(user, wsClients).catch(() => {});
    });

    ws.on('error', (err) => {
      console.error(`[WS] Socket error for ${userId}:`, err.message);
    });
  });

  // ── Heartbeat — terminate stale connections every 30 s ───────────────────
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  console.log('[WS] WebSocket server ready on path /ws');
  return wss;
};

module.exports = { initWebSocketServer };
