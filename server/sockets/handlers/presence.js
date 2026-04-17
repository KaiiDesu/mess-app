// server/sockets/handlers/presence.js - User presence handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

const handleConnect = async (socket, userId) => {
  try {
    if (!userId) {
      logger.warn('Skipping presence connect update because userId is missing', { socketId: socket.id });
      return;
    }

    // Update user online status
    const { error } = await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to update user online status', { error: error.message });
      return;
    }

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

    // Broadcast presence to friends
    const { data: friends } = await supabase
      .from('friendships')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (friends) {
      friends.forEach((friendship) => {
        const friendId = friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id;
        socket.to(friendId).emit('user:presence_update', {
          userId,
          is_online: true,
          last_seen_at: new Date().toISOString()
        });
      });
    }

    logger.info('User online', { userId });
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

    const timestamp = new Date().toISOString();

    // Update user online status
    const { error } = await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen_at: timestamp
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to update user offline status', { error: error.message });
      return;
    }

    // Broadcast offline status to friends
    const { data: friends } = await supabase
      .from('friendships')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (friends) {
      friends.forEach((friendship) => {
        const friendId = friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id;
        socket.to(friendId).emit('user:presence_update', {
          userId,
          is_online: false,
          last_seen_at: timestamp
        });
      });
    }

    logger.info('User offline', { userId });
  } catch (err) {
    logger.error('Error in handleDisconnect', { error: err.message });
  }
};

module.exports = {
  handleConnect,
  handleDisconnect
};
