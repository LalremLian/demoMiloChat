const { WebSocketServer } = require('ws');
const { authenticateWsConnection } = require('./wsAuth');
const { handleMessage, handleConnect, handleDisconnect } = require('./wsHandler');

/**
 * Attaches a WebSocket server to an existing HTTP server instance.
 *
 * Works behind Render's proxy — TLS is terminated at the proxy level,
 * so internally everything runs over plain HTTP/WS on PORT 10000.
 * Clients connect with wss:// (Render handles the TLS upgrade).
 *
 * @param {import('http').Server} httpServer
 * @param {import('express').Application} app
 */
const initWebSocketServer = (httpServer, app) => {
  // In-memory map: userId (string) → WebSocket instance
  const wsClients = new Map();
  app.set('wsClients', wsClients);

  // noServer: true — we handle the upgrade manually so we can auth before
  // the WS handshake completes and reject with a proper HTTP 401
  const wss = new WebSocketServer({ noServer: true });

  // ── Authenticate on upgrade (before socket is established) ───────────────
  httpServer.on('upgrade', async (req, socket, head) => {
    // Only handle /ws path — ignore anything else (e.g. Render internal pings)
    const pathname = req.url ? req.url.split('?')[0] : '';
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    try {
      const user = await authenticateWsConnection(req);
      req._wsUser = user;

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

    // Replace any stale connection for this user (reconnect scenario)
    const existing = wsClients.get(userId);
    if (existing && existing.readyState === 1 /* OPEN */) {
      existing.close(1001, 'Replaced by new connection');
    }
    wsClients.set(userId, ws);

    console.log(`[WS] Connected: ${user.username} (${userId}) — total: ${wsClients.size}`);

    // Update DB + broadcast user_online
    handleConnect(user, wsClients).catch(() => {});

    // ── Incoming messages ──────────────────────────────────────────────────
    ws.on('message', (rawMessage) => {
      handleMessage(ws, user, rawMessage, wsClients).catch((err) => {
        console.error(`[WS] Message error for ${userId}:`, err.message);
      });
    });

    // ── Ping/pong keepalive ────────────────────────────────────────────────
    // Render's proxy has a 55s idle timeout — ping every 25s to keep alive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // ── Disconnect ─────────────────────────────────────────────────────────
    ws.on('close', (code, reason) => {
      if (wsClients.get(userId) === ws) {
        wsClients.delete(userId);
      }
      console.log(`[WS] Disconnected: ${user.username} (${userId}) code=${code} — total: ${wsClients.size}`);
      handleDisconnect(user, wsClients).catch(() => {});
    });

    ws.on('error', (err) => {
      console.error(`[WS] Socket error for ${userId}:`, err.message);
    });
  });

  // ── Heartbeat every 25s ───────────────────────────────────────────────────
  // Render proxy closes idle connections after 55s — ping every 25s to stay alive
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 25_000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  console.log('[WS] WebSocket server ready on path /ws');
  return wss;
};

module.exports = { initWebSocketServer };
