// server/sockets/handlers/presence.js - User presence handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

const userPresenceState = new Map();
const HEARTBEAT_TIMEOUT_MS = 30000;
const HEARTBEAT_SWEEP_MS = 10000;

let heartbeatSweepTimer = null;

function isSocketStateFresh(state) {
  if (!state) return false;
  const lastHeartbeatAt = Number(state.lastHeartbeatAt || 0);
  if (!lastHeartbeatAt) return false;
  return Date.now() - lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS;
}

function ensureHeartbeatSweeperRunning() {
  if (heartbeatSweepTimer) return;

  heartbeatSweepTimer = setInterval(async () => {
    const userEntries = [...userPresenceState.entries()];
    for (const [userId, entry] of userEntries) {
      const previousStatus = entry.status || 'offline';
      const nextStatus = computeAggregateStatus(entry);
      entry.status = nextStatus;

      if (!entry.sockets.size) {
        userPresenceState.delete(userId);
      }

      if (previousStatus !== nextStatus) {
        const fallbackSocketState = [...entry.sockets.values()].find(
          (socketState) => socketState?.socketRef && socketState.socketRef.connected
        );

        if (fallbackSocketState?.socketRef) {
          // eslint-disable-next-line no-await-in-loop
          await persistAndBroadcastPresence(fallbackSocketState.socketRef, userId, nextStatus);
        }
      }
    }
  }, HEARTBEAT_SWEEP_MS);
}

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
  const socketStates = [...entry.sockets.values()].filter((state) => isSocketStateFresh(state));
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

  ensureHeartbeatSweeperRunning();

  const entry = getOrCreateUserPresenceEntry(userId);
  const previousStatus = entry.status || 'offline';

  if (nextSocketState === null) {
    entry.sockets.delete(socket.id);
  } else {
    const current = entry.sockets.get(socket.id) || {};
    entry.sockets.set(socket.id, {
      foreground: nextSocketState.foreground !== false,
      networkOnline: nextSocketState.networkOnline !== false,
      lastHeartbeatAt: Number(nextSocketState.lastHeartbeatAt || current.lastHeartbeatAt || Date.now()),
      socketRef: socket
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
      networkOnline: true,
      lastHeartbeatAt: Date.now()
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
      networkOnline: data?.networkOnline !== false,
      lastHeartbeatAt: Date.now()
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
      networkOnline: data?.online !== false,
      lastHeartbeatAt: Date.now()
    });
  } catch (err) {
    logger.error('Error in handleNetworkStateUpdate', { error: err.message });
  }
};

const handleHeartbeat = async (socket, data, userId) => {
  try {
    if (!userId) return;

    const entry = getOrCreateUserPresenceEntry(userId);
    const current = entry.sockets.get(socket.id) || {
      foreground: true,
      networkOnline: true
    };

    await applyPresenceUpdate(socket, userId, {
      foreground: typeof data?.foreground === 'boolean' ? data.foreground : current.foreground !== false,
      networkOnline:
        typeof data?.networkOnline === 'boolean' ? data.networkOnline : current.networkOnline !== false,
      lastHeartbeatAt: Date.now()
    });
  } catch (err) {
    logger.error('Error in handleHeartbeat', { error: err.message });
  }
};

module.exports = {
  handleConnect,
  handleDisconnect,
  handleAppStateUpdate,
  handleNetworkStateUpdate,
  handleHeartbeat
};
