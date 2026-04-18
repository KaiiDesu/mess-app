// server/index.js - Main entry point
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');
const { initializeSocket } = require('./sockets/index');
const logger = require('./utils/logger');

const socketCorsOrigins = (process.env.SOCKET_IO_CORS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: socketCorsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

// Logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route handlers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', authMiddleware.verifyToken, require('./routes/users'));
app.use('/api/conversations', authMiddleware.verifyToken, require('./routes/conversations'));
app.use('/api/media', authMiddleware.verifyToken, require('./routes/media'));
app.use('/api/friendships', authMiddleware.verifyToken, require('./routes/friendships'));
app.use('/api/link-preview', authMiddleware.verifyToken, require('./routes/link-preview'));

// Socket.io setup
initializeSocket(io, authMiddleware);

// Error handling
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Upload exceeds the 25MB limit'
    });
  }

  logger.error('Request error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    code: err.code || 'INTERNAL_ERROR',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Socket.io enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal, shutting down');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
