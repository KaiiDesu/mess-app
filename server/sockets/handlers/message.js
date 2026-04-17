// server/sockets/handlers/message.js - Message socket handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { v4: uuid } = require('uuid');

const handleSendMessage = async (socket, data, userId) => {
  try {
    const { conversationId, content, contentType, clientMessageId, mediaId, mediaUrl, fileName } = data;

    // Validate input
    if (!conversationId || (!content && !mediaUrl && !mediaId)) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing required fields',
        clientMessageId
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
        message: 'Conversation not found or access denied',
        clientMessageId
      });
    }

    let resolvedMediaId = mediaId || null;
    let resolvedContentType = contentType || (mediaUrl ? 'image' : 'text');

    if (resolvedMediaId) {
      const { data: mediaRecord, error: mediaError } = await supabase
        .from('media')
        .select('id, file_type, uploader_id')
        .eq('id', resolvedMediaId)
        .single();

      if (mediaError || !mediaRecord || mediaRecord.uploader_id !== userId) {
        return socket.emit('error', {
          code: 'MEDIA_NOT_FOUND',
          message: 'Media not found or access denied',
          clientMessageId
        });
      }

      if (!contentType && mediaRecord.file_type) {
        resolvedContentType = mediaRecord.file_type;
      }
    }

    // Insert message
    const messageId = uuid();
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: userId,
        content: content || null,
        content_type: resolvedContentType,
        media_id: resolvedMediaId
      })
      .select()
      .single();

    if (msgError) {
      logger.error('Failed to insert message', { error: msgError.message, userId });
      return socket.emit('error', {
        code: 'MESSAGE_SEND_FAILED',
        message: 'Failed to send message',
        clientMessageId
      });
    }

    // Get sender info
    const { data: sender } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single();

    // Broadcast to both users in conversation
    socket.to(conversationId).emit('message:received', {
      ...message,
      senderName: sender.display_name,
      senderAvatar: sender.avatar_url,
      mediaId: resolvedMediaId,
      mediaUrl: null,
      fileName: fileName || null,
      clientMessageId
    });

    // Send confirmation back to sender
    socket.emit('message:received', {
      ...message,
      senderName: sender.display_name,
      senderAvatar: sender.avatar_url,
      mediaId: resolvedMediaId,
      mediaUrl: null,
      fileName: fileName || null,
      clientMessageId
    });

    logger.info('Message sent', { messageId, conversationId, userId });
  } catch (err) {
    logger.error('Error in handleSendMessage', { error: err.message });
    socket.emit('error', {
      code: 'INTERNAL_ERROR',
      message: 'Server error while sending message'
    });
  }
};

const handleMarkRead = async (socket, data, userId) => {
  try {
    const { conversationId, messageIds } = data;
    const normalizedMessageIds = Array.from(
      new Set((Array.isArray(messageIds) ? messageIds : []).filter(Boolean))
    );

    if (!conversationId || !normalizedMessageIds.length) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing required fields'
      });
    }

    // Insert read receipts
    const receipts = normalizedMessageIds.map((msgId) => ({
      message_id: msgId,
      reader_id: userId
    }));

    const { error } = await supabase
      .from('message_read_receipts')
      .upsert(receipts, { onConflict: 'message_id,reader_id', ignoreDuplicates: true });

    if (error) {
      logger.error('Failed to insert read receipts', { error: error.message });
      return;
    }

    // Get sender info
    const { data: reader } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .single();

    // Broadcast read receipt
    socket.to(conversationId).emit('message:read_receipt', {
      conversationId,
      readBy: userId,
      readByName: reader.display_name,
      messageIds: normalizedMessageIds,
      readAt: new Date().toISOString()
    });

    logger.info('Messages marked as read', { conversationId, messageCount: normalizedMessageIds.length });
  } catch (err) {
    logger.error('Error in handleMarkRead', { error: err.message });
  }
};

const handleTyping = (socket, data, userId) => {
  const { conversationId } = data;

  if (!conversationId) return;

  socket.to(conversationId).emit('message:typing', {
    conversationId,
    userId,
    userName: 'User' // Could fetch real name here
  });
};

const handleTypingStop = (socket, data, userId) => {
  const { conversationId } = data;

  if (!conversationId) return;

  socket.to(conversationId).emit('message:typing_stop', {
    conversationId,
    userId
  });
};

const handleReact = async (socket, data, userId) => {
  try {
    const { messageId, emoji } = data;

    if (!messageId || !emoji) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing messageId or emoji'
      });
    }

    // Insert reaction
    const { data: reaction, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: userId,
        emoji
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to add reaction', { error: error.message });
      return socket.emit('error', {
        code: 'REACTION_FAILED',
        message: 'Failed to add reaction'
      });
    }

    // Get message to find conversation
    const { data: message } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single();

    // Broadcast reaction
    socket.to(message.conversation_id).emit('message:reaction_added', {
      messageId,
      conversationId: message.conversation_id,
      userId,
      emoji
    });

    socket.emit('message:reaction_added', {
      messageId,
      conversationId: message.conversation_id,
      userId,
      emoji
    });
  } catch (err) {
    logger.error('Error in handleReact', { error: err.message });
  }
};

const handleReactRemove = async (socket, data, userId) => {
  try {
    const { messageId, emoji } = data;

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) {
      logger.error('Failed to remove reaction', { error: error.message });
      return;
    }

    // Get message
    const { data: message } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single();

    // Broadcast removal
    socket.to(message.conversation_id).emit('message:reaction_removed', {
      messageId,
      conversationId: message.conversation_id,
      userId,
      emoji
    });
  } catch (err) {
    logger.error('Error in handleReactRemove', { error: err.message });
  }
};

module.exports = {
  handleSendMessage,
  handleMarkRead,
  handleTyping,
  handleTypingStop,
  handleReact,
  handleReactRemove
};
