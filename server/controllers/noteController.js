const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const NOTE_TTL_HOURS = 24;
const NOTE_MAX_CHARS = 60;

let notesTableUnavailable = false;

function isNotesTableMissing(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === 'PGRST205' || code === '42P01' || message.includes('user_notes');
}

async function cleanupExpiredNotes() {
  if (notesTableUnavailable) return;

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('user_notes').delete().lte('expires_at', nowIso);
  if (!error) return;

  if (isNotesTableMissing(error)) {
    notesTableUnavailable = true;
    logger.warn('Notes feature disabled: user_notes table is missing');
    return;
  }

  logger.warn('Failed to cleanup expired notes', { error: error.message });
}

async function getFriendIds(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) {
    logger.warn('Failed to fetch accepted friendships for notes', {
      userId,
      error: error.message
    });
    return [];
  }

  const ids = new Set();
  (data || []).forEach((friendship) => {
    const friendId = friendship.sender_id === userId ? friendship.receiver_id : friendship.sender_id;
    if (friendId) {
      ids.add(friendId);
    }
  });

  return [...ids];
}

async function getAudienceIds(userId) {
  const friendIds = await getFriendIds(userId);
  return [userId, ...friendIds];
}

async function hydrateNotesWithUsers(notes) {
  const userIds = [...new Set((notes || []).map((item) => item.user_id).filter(Boolean))];
  if (!userIds.length) return [];

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const userMap = new Map((users || []).map((user) => [user.id, user]));

  return (notes || []).map((note) => {
    const user = userMap.get(note.user_id) || {};
    return {
      ...note,
      display_name: user.display_name || 'User',
      avatar_url: user.avatar_url || null
    };
  });
}

async function broadcastNoteUpdated(io, authorUserId, note) {
  if (!io || !authorUserId || !note) return;

  const audience = await getAudienceIds(authorUserId);
  audience.forEach((targetUserId) => {
    io.to(`user:${targetUserId}`).emit('note:updated', {
      note
    });
  });
}

async function broadcastNoteDeleted(io, authorUserId) {
  if (!io || !authorUserId) return;

  const audience = await getAudienceIds(authorUserId);
  audience.forEach((targetUserId) => {
    io.to(`user:${targetUserId}`).emit('note:deleted', {
      userId: authorUserId
    });
  });
}

const getNotes = async (req, res) => {
  try {
    const userId = req.user.sub;
    await cleanupExpiredNotes();

    if (notesTableUnavailable) {
      return res.json({ notes: [] });
    }

    const friendIds = await getFriendIds(userId);
    const visibleUserIds = [userId, ...friendIds];

    if (!visibleUserIds.length) {
      return res.json({ notes: [] });
    }

    const nowIso = new Date().toISOString();
    const { data: notes, error } = await supabase
      .from('user_notes')
      .select('id, user_id, content, created_at, updated_at, expires_at')
      .in('user_id', visibleUserIds)
      .gt('expires_at', nowIso)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isNotesTableMissing(error)) {
        notesTableUnavailable = true;
        return res.json({ notes: [] });
      }

      logger.error('Failed to fetch notes', { userId, error: error.message });
      return res.status(500).json({
        code: 'FETCH_FAILED',
        message: 'Failed to load notes'
      });
    }

    const hydrated = await hydrateNotesWithUsers(notes || []);

    return res.json({
      notes: hydrated,
      ttlHours: NOTE_TTL_HOURS,
      maxChars: NOTE_MAX_CHARS
    });
  } catch (err) {
    logger.error('Unexpected getNotes error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to load notes'
    });
  }
};

const upsertMyNote = async (req, res) => {
  try {
    const userId = req.user.sub;
    const content = String(req.body?.content || '').trim();

    if (!content) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Note cannot be empty'
      });
    }

    if (content.length > NOTE_MAX_CHARS) {
      return res.status(400).json({
        code: 'NOTE_TOO_LONG',
        message: `Note cannot exceed ${NOTE_MAX_CHARS} characters`
      });
    }

    if (notesTableUnavailable) {
      return res.status(503).json({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Notes feature is unavailable right now'
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + NOTE_TTL_HOURS * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('user_notes')
      .upsert(
        {
          user_id: userId,
          content,
          updated_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select('id, user_id, content, created_at, updated_at, expires_at')
      .single();

    if (error) {
      if (isNotesTableMissing(error)) {
        notesTableUnavailable = true;
        return res.status(503).json({
          code: 'FEATURE_UNAVAILABLE',
          message: 'Notes feature is unavailable right now'
        });
      }

      logger.error('Failed to upsert note', { userId, error: error.message });
      return res.status(500).json({
        code: 'SAVE_FAILED',
        message: 'Failed to save note'
      });
    }

    const hydratedList = await hydrateNotesWithUsers([data]);
    const note = hydratedList[0] || data;

    await broadcastNoteUpdated(req.app.get('io'), userId, note);

    return res.json({
      note,
      ttlHours: NOTE_TTL_HOURS,
      maxChars: NOTE_MAX_CHARS
    });
  } catch (err) {
    logger.error('Unexpected upsertMyNote error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to save note'
    });
  }
};

const deleteMyNote = async (req, res) => {
  try {
    const userId = req.user.sub;

    if (notesTableUnavailable) {
      return res.json({ deleted: true });
    }

    const { error } = await supabase.from('user_notes').delete().eq('user_id', userId);

    if (error) {
      if (isNotesTableMissing(error)) {
        notesTableUnavailable = true;
        return res.json({ deleted: true });
      }

      logger.error('Failed to delete note', { userId, error: error.message });
      return res.status(500).json({
        code: 'DELETE_FAILED',
        message: 'Failed to delete note'
      });
    }

    await broadcastNoteDeleted(req.app.get('io'), userId);

    return res.json({ deleted: true });
  } catch (err) {
    logger.error('Unexpected deleteMyNote error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete note'
    });
  }
};

module.exports = {
  getNotes,
  upsertMyNote,
  deleteMyNote
};
