// server/controllers/friendshipController.js - Friendship management
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const getFriendships = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { status = 'accepted', limit = 50, offset = 0 } = req.query;

    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 50))
      .range(offset, offset + Math.min(limit, 50) - 1);

    if (error) {
      logger.error('Get friendships error', { error: error.message });
      return res.status(500).json({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch friendships'
      });
    }

    // Enrich with user details
    const enriched = await Promise.all(
      (friendships || []).map(async (friendship) => {
        const friendUserId =
          friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id;
        const { data: friend } = await supabase
          .from('users')
          .select('id, display_name, username, avatar_url, is_online, last_seen_at, status:status_message')
          .eq('id', friendUserId)
          .single();

        return {
          ...friendship,
          friend
        };
      })
    );

    res.json({
      friendships: enriched,
      count: enriched.length
    });
  } catch (err) {
    logger.error('Get friendships error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get friendships'
    });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.sub;

    const { data: requests, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Get pending requests error', { error: error.message });
      return res.status(500).json({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch requests'
      });
    }

    // Enrich with sender details
    const enriched = await Promise.all(
      (requests || []).map(async (request) => {
        const { data: sender } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, is_online')
          .eq('id', request.sender_id)
          .single();

        return {
          ...request,
          sender
        };
      })
    );

    res.json({
      requests: enriched,
      count: enriched.length
    });
  } catch (err) {
    logger.error('Get pending requests error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get pending requests'
    });
  }
};

const createFriendRequest = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { toUserId } = req.body;

    if (!toUserId || toUserId === userId) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Invalid recipient'
      });
    }

    const { data: recipient, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('id', toUserId)
      .single();

    if (recipientError || !recipient) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    const { data: created, error: createError } = await supabase
      .from('friendships')
      .insert({
        sender_id: userId,
        receiver_id: toUserId,
        status: 'pending'
      })
      .select('*')
      .single();

    if (createError) {
      logger.error('Create friend request error', { error: createError.message, code: createError.code });
      if (createError.code === '23505') {
        return res.status(409).json({
          code: 'FRIENDSHIP_EXISTS',
          message: 'Friendship request already exists'
        });
      }

      return res.status(500).json({
        code: 'FRIENDSHIP_REQUEST_FAILED',
        message: createError.message || 'Failed to send friend request'
      });
    }

    return res.status(201).json({
      request: created
    });
  } catch (err) {
    logger.error('Create friend request error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create friend request'
    });
  }
};

module.exports = {
  getFriendships,
  getPendingRequests,
  createFriendRequest
};
