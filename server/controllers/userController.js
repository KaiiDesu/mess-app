// server/controllers/userController.js - User management logic
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.sub;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, display_name, avatar_url, status:status_message, is_online, last_seen_at, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json(user);
  } catch (err) {
    logger.error('Get current user error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get user'
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, display_name, avatar_url, status:status_message, is_online, last_seen_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json(user);
  } catch (err) {
    logger.error('Get user by ID error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get user'
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q, limit = 10, offset = 0 } = req.query;
    const userId = req.user.sub;

    if (!q || q.length < 2) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Search query must be at least 2 characters'
      });
    }

    // Search by display_name, username, or email (exclude self)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, display_name, username, email, avatar_url, status:status_message, is_online')
      .neq('id', userId)
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(Math.min(limit, 50))
      .range(offset, offset + Math.min(limit, 50) - 1);

    if (error) {
      logger.error('User search error', { error: error.message });
      return res.status(500).json({
        code: 'SEARCH_FAILED',
        message: 'Search failed'
      });
    }

    res.json({
      results: users || [],
      count: users?.length || 0
    });
  } catch (err) {
    logger.error('Search users error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Search failed'
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { displayName, avatarUrl, status, statusMessage } = req.body;

    // Validate input
    const updateData = {};
    if (displayName) updateData.display_name = displayName;
    if (avatarUrl) updateData.avatar_url = avatarUrl;
    if (typeof statusMessage === 'string') {
      updateData.status_message = statusMessage.trim().slice(0, 160);
    } else if (typeof status === 'string') {
      // Backward-compatible mapping for older clients still posting "status".
      updateData.status_message = status.trim().slice(0, 160);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'No valid fields to update'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Profile update error', { error: error.message });
      return res.status(500).json({
        code: 'UPDATE_FAILED',
        message: 'Failed to update profile'
      });
    }

    logger.info('User profile updated', { userId });

    res.json(user);
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update profile'
    });
  }
};

module.exports = {
  getCurrentUser,
  getUserById,
  searchUsers,
  updateProfile
};
