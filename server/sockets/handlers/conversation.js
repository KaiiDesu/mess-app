// server/sockets/handlers/conversation.js - Conversation socket handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');

const canAccessConversation = async (conversationId, userId) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_1_id, user_2_id')
    .eq('id', conversationId)
    .single();

  if (error || !data) {
    return { allowed: false, reason: 'CONVERSATION_NOT_FOUND' };
  }

  const allowed = data.user_1_id === userId || data.user_2_id === userId;
  return { allowed, conversation: data, reason: allowed ? null : 'UNAUTHORIZED' };
};

const handleJoinConversation = async (socket, data, userId) => {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing conversationId'
      });
    }

    const access = await canAccessConversation(conversationId, userId);

    if (!access.allowed) {
      return socket.emit('error', {
        code: access.reason,
        message: access.reason === 'UNAUTHORIZED' ? 'Access denied' : 'Conversation not found'
      });
    }

    socket.join(conversationId);

    socket.emit('conversation:joined', {
      conversationId,
      joinedAt: new Date().toISOString()
    });

    logger.info('Conversation joined', { conversationId, userId, socketId: socket.id });
  } catch (err) {
    logger.error('Error in handleJoinConversation', { error: err.message });
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: 'Failed to join conversation'
    });
  }
};

const handleLeaveConversation = async (socket, data, userId) => {
  try {
    const { conversationId } = data;

    if (!conversationId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing conversationId'
      });
    }

    socket.leave(conversationId);

    socket.emit('conversation:left', {
      conversationId,
      leftAt: new Date().toISOString()
    });

    logger.info('Conversation left', { conversationId, userId, socketId: socket.id });
  } catch (err) {
    logger.error('Error in handleLeaveConversation', { error: err.message });
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: 'Failed to leave conversation'
    });
  }
};

const handleThemeUpdate = async (socket, data, userId) => {
  try {
    const { conversationId, themeName, themeGradient } = data;

    if (!conversationId || !themeName) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing required fields'
      });
    }

    // Verify user is part of conversation
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .single();

    if (convoError || !convo) {
      return socket.emit('error', {
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found'
      });
    }

    // Update theme
    const { error } = await supabase
      .from('conversations')
      .update({
        theme_name: themeName,
        theme_gradient: themeGradient
      })
      .eq('id', conversationId);

    if (error) {
      logger.error('Failed to update theme', { error: error.message });
      return socket.emit('error', {
        code: 'THEME_UPDATE_FAILED',
        message: 'Failed to update theme'
      });
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .single();

    // Broadcast theme update
    socket.to(conversationId).emit('conversation:theme_updated', {
      conversationId,
      themeName,
      themeGradient,
      changedBy: userId,
      changedByName: user.display_name,
      updatedAt: new Date().toISOString()
    });

    logger.info('Theme updated', { conversationId, themeName });
  } catch (err) {
    logger.error('Error in handleThemeUpdate', { error: err.message });
  }
};

const handleMute = async (socket, data, userId) => {
  try {
    const { conversationId, duration } = data;

    if (!conversationId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing conversationId'
      });
    }

    const muteUntil = duration ? new Date(Date.now() + duration * 1000) : null;

    const { error } = await supabase
      .from('conversations')
      .update({
        is_muted: true,
        muted_until: muteUntil
      })
      .eq('id', conversationId)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);

    if (error) {
      logger.error('Failed to mute conversation', { error: error.message });
      return;
    }

    logger.info('Conversation muted', { conversationId, userId });
  } catch (err) {
    logger.error('Error in handleMute', { error: err.message });
  }
};

const handleArchive = async (socket, data, userId) => {
  try {
    const { conversationId, isArchived } = data;

    if (!conversationId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing conversationId'
      });
    }

    const { error } = await supabase
      .from('conversations')
      .update({ is_archived: isArchived })
      .eq('id', conversationId)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`);

    if (error) {
      logger.error('Failed to archive conversation', { error: error.message });
      return;
    }

    logger.info('Conversation archived', { conversationId, userId, isArchived });
  } catch (err) {
    logger.error('Error in handleArchive', { error: err.message });
  }
};

module.exports = {
  handleJoinConversation,
  handleLeaveConversation,
  handleThemeUpdate,
  handleMute,
  handleArchive
};
