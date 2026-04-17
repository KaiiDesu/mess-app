// server/sockets/handlers/presence.js - User presence handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

const userPresenceState = new Map();

function getOrCreateUserPresenceEntry(userId) {
  if (!userPresenceState.has(userId)) {
    userPresenceState.set(userId, {
      sockets: new Map(),
      status: 'offline'
    });
  }
  return userPresenceState.get(userId);
}

function computeAggregateStatus(entry) {
  const socketStates = [...entry.sockets.values()];
  if (!socketStates.length) {
    return 'offline';
  }

  const hasNetworkOnlineSocket = socketStates.some((state) => state.networkOnline !== false);
  if (!hasNetworkOnlineSocket) {
    return 'offline';
  }

  const hasForegroundSocket = socketStates.some(
    (state) => state.networkOnline !== false && state.foreground === true
  );
  if (hasForegroundSocket) {
    return 'online';
  }

  return 'away';
}

async function broadcastPresenceToFriends(socket, userId, status, timestamp) {
  const isOnline = status !== 'offline';

  const { data: friends } = await supabase
    .from('friendships')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (!friends) return;

  friends.forEach((friendship) => {
    const friendId = friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id;
    socket.to(friendId).emit('user:presence_update', {
      userId,
      status,
      is_online: isOnline,
      last_seen_at: timestamp
    });
  });
}

async function persistAndBroadcastPresence(socket, userId, status) {
  const timestamp = new Date().toISOString();
  const isOnline = status !== 'offline';

  const { error } = await supabase
    .from('users')
    .update({
      is_online: isOnline,
      last_seen_at: timestamp
    })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to persist presence status', { userId, status, error: error.message });
    return;
  }

  await broadcastPresenceToFriends(socket, userId, status, timestamp);
}

async function applyPresenceUpdate(socket, userId, nextSocketState) {
  if (!userId) return;

  const entry = getOrCreateUserPresenceEntry(userId);
  const previousStatus = entry.status || 'offline';

  if (nextSocketState === null) {
    entry.sockets.delete(socket.id);
  } else {
    entry.sockets.set(socket.id, {
      foreground: nextSocketState.foreground !== false,
      networkOnline: nextSocketState.networkOnline !== false
    });
  }

  const nextStatus = computeAggregateStatus(entry);
  entry.status = nextStatus;

  if (!entry.sockets.size) {
    userPresenceState.delete(userId);
  }

  // Always persist on connect/disconnect transitions and when status changes.
  if (previousStatus !== nextStatus || nextSocketState === null) {
    await persistAndBroadcastPresence(socket, userId, nextStatus);
  }
}

const handleConnect = async (socket, userId) => {
  try {
    if (!userId) {
      logger.warn('Skipping presence connect update because userId is missing', { socketId: socket.id });
      return;
    }

    await applyPresenceUpdate(socket, userId, {
      foreground: true,
      networkOnline: true
    });

    // Join room with user ID (for direct messages later)
    socket.join(userId);

    // Get user's conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);

    // Join conversation rooms
    if (conversations) {
      conversations.forEach((convo) => {
        socket.join(convo.id);
      });
    }

    logger.info('User presence connected', { userId });
  } catch (err) {
    logger.error('Error in handleConnect', { error: err.message });
  }
};

const handleDisconnect = async (socket, userId) => {
  try {
    if (!userId) {
      logger.warn('Skipping presence disconnect update because userId is missing', { socketId: socket.id });
      return;
    }

    await applyPresenceUpdate(socket, userId, null);
    logger.info('User presence disconnected', { userId });
  } catch (err) {
    logger.error('Error in handleDisconnect', { error: err.message });
  }
};

const handleAppStateUpdate = async (socket, data, userId) => {
  try {
    if (!userId) return;

    await applyPresenceUpdate(socket, userId, {
      foreground: data?.foreground !== false,
      networkOnline: data?.networkOnline !== false
    });
  } catch (err) {
    logger.error('Error in handleAppStateUpdate', { error: err.message });
  }
};

const handleNetworkStateUpdate = async (socket, data, userId) => {
  try {
    if (!userId) return;

    const entry = getOrCreateUserPresenceEntry(userId);
    const current = entry.sockets.get(socket.id) || { foreground: true, networkOnline: true };

    await applyPresenceUpdate(socket, userId, {
      foreground: current.foreground !== false,
      networkOnline: data?.online !== false
    });
  } catch (err) {
    logger.error('Error in handleNetworkStateUpdate', { error: err.message });
  }
};

module.exports = {
  handleConnect,
  handleDisconnect,
  handleAppStateUpdate,
  handleNetworkStateUpdate
};
