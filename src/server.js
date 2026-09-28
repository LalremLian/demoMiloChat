// Load environment variables first — before any other require
require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');

const connectDB = require('./config/database');
const { initFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');
const { initWebSocketServer } = require('./websocket/wsServer');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const callRoutes = require('./routes/calls');
const uploadRoutes = require('./routes/uploads');

const app = express();

// ── Ensure upload directory exists ───────────────────────────────────────────
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[Server] Created upload directory: ${uploadDir}`);
}

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// ── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req._startTime = Date.now();
  next();
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const ms = Date.now() - (req._startTime || Date.now());
    console.log(`[${req.method}] ${req.originalUrl} → ${res.statusCode} ${ms}ms`);
    return originalJson(body);
  };
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/uploads', uploadRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 404,
  });
});

// ── Centralized error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

// ── Bootstrap ────────────────────────────────────────────────────────────────
const start = async () => {
  // Connect to MongoDB
  await connectDB();

  // Initialise Firebase Admin (fails gracefully if service account missing)
  initFirebase();

  // Create HTTP server and attach WebSocket server to the same port
  const httpServer = http.createServer(app);
  initWebSocketServer(httpServer, app);

  const PORT = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(PORT, () => {
    console.log(`[Server] MiloChat API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    console.log(`[Server] REST:      http://localhost:${PORT}/api`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`[Server] Health:    http://localhost:${PORT}/health`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10 s if connections linger
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
};

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
