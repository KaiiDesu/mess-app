// server/controllers/conversationController.js - Conversation management
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { v4: uuid } = require('uuid');

let nicknameTableUnavailable = false;
let replyRelationTableUnavailable = false;

const getOtherUserId = (conversation, userId) =>
  conversation.user_1_id === userId ? conversation.user_2_id : conversation.user_1_id;

const getUserClearTimestamp = (conversation, userId) =>
  conversation.user_1_id === userId ? conversation.user_1_cleared_at : conversation.user_2_cleared_at;

// Shared nickname mode: both participants read/write the same nickname rows.
// We use a deterministic owner key to stay compatible with existing table constraints.
const getSharedNicknameOwnerId = (conversation) => conversation?.user_1_id || null;

const canAccessConversation = async (conversationId, userId) => {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .single();

  if (error || !conversation) {
    return { allowed: false, conversation: null };
  }

  return { allowed: true, conversation };
};

const getNicknameForOtherUser = async (conversationId, sharedOwnerUserId, targetUserId) => {
  if (nicknameTableUnavailable) {
    return null;
  }

  const { data, error } = await supabase
    .from('conversation_nicknames')
    .select('nickname')
    .eq('conversation_id', conversationId)
    .eq('owner_user_id', sharedOwnerUserId)
    .eq('target_user_id', targetUserId)
    .maybeSingle();

  if (error) {
    const tableMissing =
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      String(error.message || '').includes('conversation_nicknames');

    if (tableMissing) {
      nicknameTableUnavailable = true;
      logger.warn('Nickname feature disabled: conversation_nicknames table is missing');
      return null;
    }

    logger.warn('Nickname lookup failed', {
      error: error.message,
      conversationId,
      ownerUserId: sharedOwnerUserId,
      targetUserId
    });
    return null;
  }

  return data?.nickname || null;
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { includeArchived = false, limit, offset } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    const shouldPaginate = Number.isFinite(parsedLimit) && parsedLimit > 0;
    const safeLimit = shouldPaginate ? Math.min(parsedLimit, 500) : null;
    const safeOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    let query = supabase
      .from('conversations')
      .select(
        `
        *,
        messages(id, sender_id, content, content_type, media_id, created_at)
      `
      )
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (includeArchived === 'false') {
      query = query.eq('is_archived', false);
    }

    if (shouldPaginate) {
      query = query.range(safeOffset, safeOffset + safeLimit - 1);
    }

    const { data: conversations, error } = await query;

    if (error) {
      logger.error('Get conversations error', { error: error.message });
      return res.status(500).json({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch conversations'
      });
    }

    // Get other user info for each conversation
    const enrichedRaw = await Promise.all(
      (conversations || []).map(async (convo) => {
        const otherUserId = getOtherUserId(convo, userId);
        const sharedNicknameOwnerId = getSharedNicknameOwnerId(convo);
        const clearTimestamp = getUserClearTimestamp(convo, userId);
        const { data: otherUser } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, is_online, status:status_message')
          .eq('id', otherUserId)
          .single();
        const nickname = await getNicknameForOtherUser(
          convo.id,
          sharedNicknameOwnerId,
          otherUserId
        );

        // Compute unread count: messages from the other user that current user has not marked as read.
        let unreadMessagesQuery = supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', convo.id)
          .neq('sender_id', userId);

        if (clearTimestamp) {
          unreadMessagesQuery = unreadMessagesQuery.gt('created_at', clearTimestamp);
        }

        const { data: otherUserMessages, error: otherMessagesError } = await unreadMessagesQuery;

        let unreadCount = 0;
        if (!otherMessagesError && otherUserMessages?.length) {
          const messageIds = otherUserMessages.map((m) => m.id);
          const { data: readReceipts, error: receiptError } = await supabase
            .from('message_read_receipts')
            .select('message_id')
            .eq('reader_id', userId)
            .in('message_id', messageIds);

          if (!receiptError) {
            const readSet = new Set((readReceipts || []).map((r) => r.message_id));
            unreadCount = messageIds.filter((id) => !readSet.has(id)).length;
          }
        }

        const visibleMessages = (convo.messages || []).filter((message) => {
          if (!clearTimestamp) return true;
          return new Date(message.created_at) > new Date(clearTimestamp);
        });

        const sortedMessages = [...visibleMessages].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        const lastMessage = sortedMessages[0] || null;
        let lastMessageWithSeenState = null;
        if (lastMessage) {
          const { data: lastMessageReceipts, error: lastMessageReceiptsError } = await supabase
            .from('message_read_receipts')
            .select('reader_id')
            .eq('message_id', lastMessage.id);

          const isSeenByOther =
            !lastMessageReceiptsError &&
            Array.isArray(lastMessageReceipts) &&
            lastMessageReceipts.some((receipt) => receipt.reader_id && receipt.reader_id !== userId);

          lastMessageWithSeenState = {
            ...lastMessage,
            is_seen_by_other: isSeenByOther
          };
        }

        const hiddenForUser = Boolean(clearTimestamp && !lastMessage);

        return {
          ...convo,
          otherUser: {
            ...otherUser,
            nickname
          },
          unreadCount,
          lastMessage: lastMessageWithSeenState,
          hiddenForUser
        };
      })
    );

    const enriched = enrichedRaw.filter((item) => !item.hiddenForUser);

    res.json({
      conversations: enriched,
      count: enriched.length
    });
  } catch (err) {
    logger.error('Get conversations error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get conversations'
    });
  }
};

const getConversation = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const { data: conversation, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .single();

    if (convoError || !conversation) {
      return res.status(404).json({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found'
      });
    }

    // Get other user
    const otherUserId = getOtherUserId(conversation, userId);
    const sharedNicknameOwnerId = getSharedNicknameOwnerId(conversation);
    const { data: otherUser } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, is_online, status:status_message')
      .eq('id', otherUserId)
      .single();
    const nickname = await getNicknameForOtherUser(
      conversation.id,
      sharedNicknameOwnerId,
      otherUserId
    );

    res.json({
      ...conversation,
      otherUser: {
        ...otherUser,
        nickname
      }
    });
  } catch (err) {
    logger.error('Get conversation error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get conversation'
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { limit, offset } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    const shouldPaginate = Number.isFinite(parsedLimit) && parsedLimit > 0;
    const safeLimit = shouldPaginate ? Math.min(parsedLimit, 1000) : null;
    const safeOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    // Verify access
    const { data: conversation, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .single();

    if (convoError || !conversation) {
      return res.status(403).json({
        code: 'UNAUTHORIZED',
        message: 'Access denied'
      });
    }

    const clearTimestamp = getUserClearTimestamp(conversation, userId);

    // Get messages (only those visible for this user after their personal clear timestamp)
    let messagesQuery = supabase
      .from('messages')
      .select(
        `
        *,
        sender:sender_id(id, display_name, avatar_url),
        reactions:message_reactions(user_id, emoji)
      `
      )
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (shouldPaginate) {
      messagesQuery = messagesQuery.range(safeOffset, safeOffset + safeLimit - 1);
    }

    if (clearTimestamp) {
      messagesQuery = messagesQuery.gt('created_at', clearTimestamp);
    }

    const { data: messages, error } = await messagesQuery;

    if (error) {
      logger.error('Get messages error', { error: error.message });
      return res.status(500).json({
        code: 'FETCH_FAILED',
        message: 'Failed to fetch messages'
      });
    }

    const mediaIds = (messages || [])
      .map((m) => m.media_id)
      .filter(Boolean);

    let mediaById = new Map();
    if (mediaIds.length) {
      const { data: mediaRows } = await supabase
        .from('media')
        .select('id, storage_url')
        .in('id', mediaIds);

      mediaById = new Map((mediaRows || []).map((row) => [row.id, row.storage_url]));
    }

    // Get read receipts for messages
    const messageIds = messages?.map((m) => m.id) || [];
    const { data: receipts } = await supabase
      .from('message_read_receipts')
      .select('message_id, reader_id')
      .in('message_id', messageIds);

    let replyRelationByMessageId = new Map();
    if (messageIds.length && !replyRelationTableUnavailable) {
      // Validate and sanitize message IDs to avoid Bad Request from PostgREST
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const validMessageIds = messageIds.filter((m) => typeof m === 'string' && uuidRe.test(m));

      if (!validMessageIds.length) {
        logger.warn('No valid message IDs to query for reply fallback', { conversationId: id, messageIdsSample: messageIds.slice(0, 10) });
      } else {
        try {
          // Query in batches to avoid large URL/param issues and reduce RLS surprises
          const batchSize = 50;
          let accumulatedRows = [];

          for (let i = 0; i < validMessageIds.length; i += batchSize) {
            const chunk = validMessageIds.slice(i, i + batchSize);
            const { data: chunkRows, error: chunkErr } = await supabase
              .from('message_replies')
              .select('message_id, parent_message_id, parent_sender_name, parent_snippet')
              .in('message_id', chunk);

            if (chunkErr) {
              const tableMissing =
                chunkErr.code === '42P01' ||
                chunkErr.code === 'PGRST205' ||
                String(chunkErr.message || '').includes('message_replies');

              logger.warn('Failed to query message_replies (chunk)', {
                error: chunkErr,
                conversationId: id,
                chunkSize: chunk.length,
                chunkSample: chunk.slice(0, 5)
              });

              if (tableMissing) {
                replyRelationTableUnavailable = true;
                logger.warn('Reply fallback load disabled: message_replies table is missing');
                break;
              }

              // For other errors (Bad Request), skip this fallback but continue
              logger.warn('Skipping reply fallback chunk due to error', { conversationId: id });
              continue;
            }

            accumulatedRows = accumulatedRows.concat(chunkRows || []);
          }

          // Build the map from accumulated rows
          try {
            replyRelationByMessageId = new Map((accumulatedRows || []).map((row) => [row.message_id, row]));
          } catch (mapErr) {
            logger.warn('Failed to build replyRelation map', { error: mapErr.message, conversationId: id });
            replyRelationByMessageId = new Map();
          }
        } catch (outerErr) {
          logger.warn('Unexpected error while loading reply fallback', { error: outerErr.message, conversationId: id });
        }
      }
    }

    // Attach receipts to messages
    const messagesWithReceipts = (messages || []).map((msg) => ({
      ...msg,
      mediaUrl: msg.media_id ? mediaById.get(msg.media_id) || null : null,
      readBy: receipts?.filter((r) => r.message_id === msg.id).map((r) => r.reader_id) || []
    }));

    const parentMessageIds = [...new Set(
      messagesWithReceipts
        .map((msg) => msg.parent_message_id || replyRelationByMessageId.get(msg.id)?.parent_message_id)
        .filter(Boolean)
    )];

    let parentMessageById = new Map();
    if (parentMessageIds.length) {
      const { data: parentMessages } = await supabase
        .from('messages')
        .select('id, sender_id, content, content_type, sender:sender_id(display_name)')
        .in('id', parentMessageIds);

      parentMessageById = new Map(
        (parentMessages || []).map((parent) => {
          const snippet =
            parent.content_type === 'image'
              ? 'Photo'
              : parent.content_type === 'video'
              ? 'Video'
              : parent.content_type === 'audio'
              ? 'Voice message'
              : String(parent.content || '').trim() || 'Message';

          return [
            parent.id,
            {
              id: parent.id,
              senderId: parent.sender_id,
              senderName: parent?.sender?.display_name || 'User',
              snippet
            }
          ];
        })
      );
    }

    const messagesWithReplyPreview = messagesWithReceipts.map((msg) => {
      const fallbackRelation = replyRelationByMessageId.get(msg.id) || null;
      const parentMessageId = msg.parent_message_id || fallbackRelation?.parent_message_id || null;

      let replyPreview = parentMessageId ? parentMessageById.get(parentMessageId) || null : null;

      if (!replyPreview && fallbackRelation && parentMessageId) {
        replyPreview = {
          id: parentMessageId,
          senderId: null,
          senderName: String(fallbackRelation.parent_sender_name || 'User').trim() || 'User',
          snippet: String(fallbackRelation.parent_snippet || 'Message').trim() || 'Message'
        };
      }

      return {
        ...msg,
        reply_to: replyPreview
      };
    });

    res.json({
      messages: messagesWithReplyPreview,
      count: messagesWithReplyPreview.length
    });
  } catch (err) {
    logger.error('Get messages error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get messages'
    });
  }
};

const createConversation = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { withUserId } = req.body;

    // Ensure requester has a valid user profile row in our users table.
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({
        code: 'REQUESTER_NOT_FOUND',
        message: 'Current authenticated user does not exist in users table'
      });
    }

    if (!withUserId) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'withUserId required'
      });
    }

    if (withUserId === userId) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Cannot start conversation with self'
      });
    }

    // Check if other user exists
    const { data: otherUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', withUserId)
      .single();

    if (userError || !otherUser) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Check if conversation already exists (order matters for uniqueness)
    const user1 = userId < withUserId ? userId : withUserId;
    const user2 = userId < withUserId ? withUserId : userId;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_1_id', user1)
      .eq('user_2_id', user2)
      .single();

    if (existing) {
      // Return existing conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', existing.id)
        .single();

      return res.json(conversation);
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        id: uuid(),
        user_1_id: user1,
        user_2_id: user2
      })
      .select()
      .single();

    if (error) {
      logger.error('Create conversation error', { error: error.message, code: error.code, userId, withUserId });
      return res.status(500).json({
        code: 'CREATE_FAILED',
        message: error.message || 'Failed to create conversation'
      });
    }

    logger.info('Conversation created', { conversationId: conversation.id });

    res.status(201).json(conversation);
  } catch (err) {
    logger.error('Create conversation error', { error: err.message });
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create conversation'
    });
  }
};

const updateConversationTheme = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { themeName, themeGradient } = req.body;

    if (!themeName) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'themeName is required'
      });
    }

    const access = await canAccessConversation(id, userId);
    if (!access.allowed) {
      return res.status(404).json({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found'
      });
    }

    const { data: updated, error } = await supabase
      .from('conversations')
      .update({
        theme_name: themeName,
        theme_gradient: themeGradient || null
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      logger.error('Update conversation theme error', { error: error?.message, conversationId: id });
      return res.status(500).json({
        code: 'THEME_UPDATE_FAILED',
        message: 'Failed to update conversation theme'
      });
    }

    return res.json({ conversation: updated });
  } catch (err) {
    logger.error('Update conversation theme error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update conversation theme'
    });
  }
};

const updateConversationNickname = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { nickname } = req.body;
    const io = req.app.get('io');

    const access = await canAccessConversation(id, userId);
    if (!access.allowed) {
      return res.status(404).json({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found'
      });
    }

    const conversation = access.conversation;
    const targetUserId = getOtherUserId(conversation, userId);
    const sharedNicknameOwnerId = getSharedNicknameOwnerId(conversation);
    const normalizedNickname = typeof nickname === 'string' ? nickname.trim() : '';

    if (!normalizedNickname) {
      const { error: deleteError } = await supabase
        .from('conversation_nicknames')
        .delete()
        .eq('conversation_id', id)
        .eq('owner_user_id', sharedNicknameOwnerId)
        .eq('target_user_id', targetUserId);

      if (deleteError) {
        const tableMissing =
          deleteError.code === 'PGRST205' ||
          deleteError.code === '42P01' ||
          String(deleteError.message || '').includes('conversation_nicknames');

        if (tableMissing) {
          nicknameTableUnavailable = true;
          return res.status(500).json({
            code: 'MIGRATION_REQUIRED',
            message: 'Nickname table is missing. Apply server/sql/2026-04-17-conversation-nicknames.sql.'
          });
        }

        logger.error('Delete nickname error', { error: deleteError.message, conversationId: id });
        return res.status(500).json({
          code: 'NICKNAME_UPDATE_FAILED',
          message: 'Failed to remove nickname'
        });
      }

      io?.to(id).emit('conversation:nickname_updated', {
        conversationId: id,
        targetUserId,
        nickname: null,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });
      io?.to(`user:${conversation.user_1_id}`).emit('conversation:nickname_updated', {
        conversationId: id,
        targetUserId,
        nickname: null,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });
      io?.to(`user:${conversation.user_2_id}`).emit('conversation:nickname_updated', {
        conversationId: id,
        targetUserId,
        nickname: null,
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });

      return res.json({
        conversationId: id,
        targetUserId,
        nickname: null
      });
    }

    const { data: upserted, error } = await supabase
      .from('conversation_nicknames')
      .upsert(
        {
          conversation_id: id,
          owner_user_id: sharedNicknameOwnerId,
          target_user_id: targetUserId,
          nickname: normalizedNickname
        },
        {
          onConflict: 'conversation_id,owner_user_id,target_user_id'
        }
      )
      .select('conversation_id, target_user_id, nickname')
      .single();

    if (error || !upserted) {
      const tableMissing =
        error?.code === 'PGRST205' ||
        error?.code === '42P01' ||
        String(error?.message || '').includes('conversation_nicknames');

      if (tableMissing) {
        nicknameTableUnavailable = true;
        return res.status(500).json({
          code: 'MIGRATION_REQUIRED',
          message: 'Nickname table is missing. Apply server/sql/2026-04-17-conversation-nicknames.sql.'
        });
      }

      logger.error('Upsert nickname error', { error: error?.message, conversationId: id });
      return res.status(500).json({
        code: 'NICKNAME_UPDATE_FAILED',
        message: 'Failed to update nickname'
      });
    }

    io?.to(id).emit('conversation:nickname_updated', {
      conversationId: upserted.conversation_id,
      targetUserId: upserted.target_user_id,
      nickname: upserted.nickname,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    });
    io?.to(`user:${conversation.user_1_id}`).emit('conversation:nickname_updated', {
      conversationId: upserted.conversation_id,
      targetUserId: upserted.target_user_id,
      nickname: upserted.nickname,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    });
    io?.to(`user:${conversation.user_2_id}`).emit('conversation:nickname_updated', {
      conversationId: upserted.conversation_id,
      targetUserId: upserted.target_user_id,
      nickname: upserted.nickname,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    });

    return res.json({
      conversationId: upserted.conversation_id,
      targetUserId: upserted.target_user_id,
      nickname: upserted.nickname
    });
  } catch (err) {
    logger.error('Update conversation nickname error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update nickname'
    });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const access = await canAccessConversation(id, userId);
    if (!access.allowed) {
      return res.status(404).json({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found'
      });
    }

    const clearColumn =
      access.conversation.user_1_id === userId ? 'user_1_cleared_at' : 'user_2_cleared_at';

    const { error } = await supabase
      .from('conversations')
      .update({
        [clearColumn]: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      const clearColumnsMissing =
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        String(error.message || '').includes('user_1_cleared_at') ||
        String(error.message || '').includes('user_2_cleared_at');

      if (clearColumnsMissing) {
        // Fallback for environments where migration hasn't been applied yet.
        const { error: deleteError } = await supabase.from('conversations').delete().eq('id', id);

        if (!deleteError) {
          logger.warn('Delete conversation fallback: hard delete used because clear columns are missing', {
            conversationId: id,
            userId
          });
          return res.json({ success: true, conversationId: id, scope: 'global_fallback' });
        }

        logger.error('Delete conversation fallback failed', {
          error: deleteError.message,
          conversationId: id
        });

        return res.status(500).json({
          code: 'MIGRATION_REQUIRED',
          message:
            'Conversation clear columns are missing, and fallback delete failed. Apply server/sql/2026-04-17-conversation-clear-columns.sql.'
        });
      }

      logger.error('Delete conversation error', { error: error.message, conversationId: id });
      return res.status(500).json({
        code: 'DELETE_FAILED',
        message: 'Failed to delete conversation'
      });
    }

    return res.json({ success: true, conversationId: id, scope: 'personal' });
  } catch (err) {
    logger.error('Delete conversation error', { error: err.message });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete conversation'
    });
  }
};

module.exports = {
  getConversations,
  getConversation,
  getMessages,
  createConversation,
  updateConversationTheme,
  updateConversationNickname,
  deleteConversation
};
