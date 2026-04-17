// server/sockets/handlers/friendship.js - Friendship socket handlers
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { v4: uuid } = require('uuid');

const ensureDirectConversation = async (userAId, userBId) => {
  const user1 = userAId < userBId ? userAId : userBId;
  const user2 = userAId < userBId ? userBId : userAId;

  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id, user_1_id, user_2_id, created_at, updated_at')
    .eq('user_1_id', user1)
    .eq('user_2_id', user2)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || 'Failed to check existing conversation');
  }

  if (existing) {
    return { conversation: existing, created: false };
  }

  const { data: createdConversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      id: uuid(),
      user_1_id: user1,
      user_2_id: user2
    })
    .select('id, user_1_id, user_2_id, created_at, updated_at')
    .single();

  if (createError || !createdConversation) {
    throw new Error(createError?.message || 'Failed to create conversation');
  }

  return { conversation: createdConversation, created: true };
};

const handleRequestSend = async (socket, data, userId) => {
  try {
    const { toUserId } = data;

    if (!toUserId || toUserId === userId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Invalid recipient'
      });
    }

    // Check if users exist
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', toUserId)
      .single();

    if (!user) {
      return socket.emit('error', {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Create friendship request
    const { data: friendship, error } = await supabase
      .from('friendships')
      .insert({
        id: uuid(),
        sender_id: userId,
        receiver_id: toUserId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - request already exists
        return socket.emit('error', {
          code: 'FRIENDSHIP_EXISTS',
          message: 'Friendship request already exists'
        });
      }
      logger.error('Failed to create friendship', { error: error.message });
      return socket.emit('error', {
        code: 'FRIENDSHIP_REQUEST_FAILED',
        message: 'Failed to send friend request'
      });
    }

    // Get sender info
    const { data: sender } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single();

    // Send to receiver
    socket.to(toUserId).emit('friendship:request_received', {
      id: friendship.id,
      fromUserId: userId,
      fromUserName: sender.display_name,
      fromUserAvatar: sender.avatar_url,
      createdAt: friendship.created_at
    });

    // Confirm to sender
    socket.emit('friendship:request_received', friendship);

    logger.info('Friend request sent', { fromUserId: userId, toUserId });
  } catch (err) {
    logger.error('Error in handleRequestSend', { error: err.message });
  }
};

const handleRequestAccept = async (socket, data, userId) => {
  try {
    const { friendshipId } = data;

    if (!friendshipId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing friendshipId'
      });
    }

    // Update friendship status
    const { data: friendship, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .eq('receiver_id', userId)
      .select()
      .single();

    if (error || !friendship) {
      logger.error('Failed to accept friendship', { error: error?.message });
      return socket.emit('error', {
        code: 'FRIENDSHIP_REQUEST_FAILED',
        message: 'Failed to accept friend request'
      });
    }

    // Fetch receiver (accepting user) info.
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .single();

    // Create or reuse a direct conversation immediately when friendship becomes accepted.
    const { conversation, created } = await ensureDirectConversation(userId, friendship.sender_id);

    const senderPayload = {
      id: friendship.id,
      userId,
      userName: user?.display_name || 'Unknown user',
      userAvatar: user?.avatar_url || null,
      status: 'accepted',
      conversation,
      conversationCreated: created
    };

    const receiverPayload = {
      id: friendship.id,
      userId: friendship.sender_id,
      status: 'accepted',
      conversation,
      conversationCreated: created
    };

    // Notify sender and all receiver sockets so both sides can open/join the same conversation.
    socket.to(friendship.sender_id).emit('friendship:request_accepted', senderPayload);
    socket.emit('friendship:request_accepted', receiverPayload);
    socket.to(userId).emit('friendship:request_accepted', receiverPayload);

    logger.info('Friend request accepted', {
      userId,
      senderId: friendship.sender_id,
      conversationId: conversation.id,
      conversationCreated: created
    });
  } catch (err) {
    logger.error('Error in handleRequestAccept', { error: err.message });
  }
};

const handleRequestDecline = async (socket, data, userId) => {
  try {
    const { friendshipId } = data;

    if (!friendshipId) {
      return socket.emit('error', {
        code: 'INVALID_INPUT',
        message: 'Missing friendshipId'
      });
    }

    // Delete friendship request
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) {
      logger.error('Failed to decline friendship', { error: error.message });
      return socket.emit('error', {
        code: 'FRIENDSHIP_REQUEST_FAILED',
        message: 'Failed to decline friend request'
      });
    }

    socket.emit('friendship:request_declined', { id: friendshipId });

    logger.info('Friend request declined', { userId });
  } catch (err) {
    logger.error('Error in handleRequestDecline', { error: err.message });
  }
};

module.exports = {
  handleRequestSend,
  handleRequestAccept,
  handleRequestDecline
};
