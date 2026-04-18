// server/sockets/index.js - Socket.io event handlers
const messageSocket = require('./handlers/message');
const friendshipSocket = require('./handlers/friendship');
const conversationSocket = require('./handlers/conversation');
const presenceSocket = require('./handlers/presence');
const { verifySocketToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const initializeSocket = (io, authMiddleware) => {
  // Middleware: Verify JWT from query params
  io.use((socket, next) => {
    const token = socket.handshake.query.token;
    authMiddleware.verifySocketToken(token, (err, decoded) => {
      if (err) {
        return next(new Error('AUTH_FAILED'));
      }
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const userId = socket.user.sub; // Supabase JWT uses 'sub' for user ID

    socket.join(`user:${userId}`);

    logger.info('User connected', { userId, socketId: socket.id });

    // Update user presence
    presenceSocket.handleConnect(socket, userId);

    // Message handlers
    socket.on('message:send', (data) => messageSocket.handleSendMessage(socket, data, userId));
    socket.on('message:read', (data) => messageSocket.handleMarkRead(socket, data, userId));
    socket.on('message:typing', (data) => messageSocket.handleTyping(socket, data, userId));
    socket.on('message:typing_stop', (data) => messageSocket.handleTypingStop(socket, data, userId));
    socket.on('message:react', (data) => messageSocket.handleReact(socket, data, userId));
    socket.on('message:react_remove', (data) => messageSocket.handleReactRemove(socket, data, userId));
    socket.on('presence:app_state', (data) =>
      presenceSocket.handleAppStateUpdate(socket, data, userId)
    );
    socket.on('presence:network_state', (data) =>
      presenceSocket.handleNetworkStateUpdate(socket, data, userId)
    );
    socket.on('presence:heartbeat', (data) =>
      presenceSocket.handleHeartbeat(socket, data, userId)
    );

    // Friendship handlers
    socket.on('friendship:request_send', (data) =>
      friendshipSocket.handleRequestSend(socket, data, userId)
    );
    socket.on('friendship:request_accept', (data) =>
      friendshipSocket.handleRequestAccept(socket, data, userId)
    );
    socket.on('friendship:request_decline', (data) =>
      friendshipSocket.handleRequestDecline(socket, data, userId)
    );

    // Conversation handlers
    socket.on('conversation:join', (data) =>
      conversationSocket.handleJoinConversation(socket, data, userId)
    );
    socket.on('conversation:leave', (data) =>
      conversationSocket.handleLeaveConversation(socket, data, userId)
    );
    socket.on('conversation:theme_update', (data) =>
      conversationSocket.handleThemeUpdate(socket, data, userId)
    );
    socket.on('conversation:mute', (data) => conversationSocket.handleMute(socket, data, userId));
    socket.on('conversation:archive', (data) =>
      conversationSocket.handleArchive(socket, data, userId)
    );

    // Disconnect
    socket.on('disconnect', () => {
      logger.info('User disconnected', { userId, socketId: socket.id });
      presenceSocket.handleDisconnect(socket, userId);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error', { userId, error: error.message });
    });
  });
};

module.exports = { initializeSocket };
