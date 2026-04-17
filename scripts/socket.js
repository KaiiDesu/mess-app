function getSocketToken() {
  if (typeof window.getStoredAuthToken === 'function') {
    return window.getStoredAuthToken();
  }
  return (
    localStorage.getItem('zap_jwt') ||
    sessionStorage.getItem('zap_jwt') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}

function isAppForeground() {
  return window.__zapAppForeground !== false;
}

function areReadReceiptsEnabled() {
  return window.__zapReadReceiptsEnabled !== false;
}

function setAppForeground(value) {
  window.__zapAppForeground = Boolean(value);
}

function setReadReceiptsEnabled(value) {
  window.__zapReadReceiptsEnabled = Boolean(value);
}

function ensureAppForegroundTracking() {
  if (window.__zapForegroundTrackingInitialized) return;
  window.__zapForegroundTrackingInitialized = true;

  setAppForeground(true);
  setReadReceiptsEnabled(true);

  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    setAppForeground(visible);
    if (!visible) {
      setReadReceiptsEnabled(false);
    }
  });

  // Mobile webviews and desktop browsers can differ in which lifecycle events fire.
  window.addEventListener('focus', () => setAppForeground(true));
  window.addEventListener('blur', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
  });
  window.addEventListener('pageshow', () => setAppForeground(true));
  window.addEventListener('pagehide', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
  });

  document.addEventListener('resume', () => setAppForeground(true));
  document.addEventListener('pause', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
  });

  const enableOnInteraction = () => {
    if (isAppForeground()) {
      setReadReceiptsEnabled(true);
    }
  };

  document.addEventListener('pointerdown', enableOnInteraction, { passive: true });
  document.addEventListener('touchstart', enableOnInteraction, { passive: true });
  document.addEventListener('keydown', enableOnInteraction);
  document.addEventListener('wheel', enableOnInteraction, { passive: true });
}

function isConversationCurrentlyVisibleOnScreen(conversationId) {
  if (!conversationId) return false;
  if (currentView !== 'view-chat') return false;
  if (window.activeConversationId !== conversationId) return false;
  if (!isAppForeground()) return false;
  if (!areReadReceiptsEnabled()) return false;
  if (document.visibilityState !== 'visible') return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return true;
}

function getApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getCurrentSessionUserId() {
  try {
    const user =
      (typeof window.getStoredSessionUser === 'function' && window.getStoredSessionUser()) ||
      JSON.parse(localStorage.getItem('zap_user') || sessionStorage.getItem('zap_user') || '{}');
    return user.id || null;
  } catch (_) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitialAvatar(name) {
  const text = String(name || '').trim();
  return text ? text.charAt(0).toUpperCase() : '🙂';
}

function formatChatTimeLabel(isoDate) {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  if (sameDay) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getConversationPreview(conversation) {
  const lastMessage = conversation?.lastMessage || {};
  const contentType = String(lastMessage.content_type || '').toLowerCase();
  const text = lastMessage.content || '';

  if (contentType === 'image' || String(text).startsWith('data:image/')) {
    return 'Sent a photo';
  }

  if (contentType === 'video' || String(text).startsWith('data:video/')) {
    return 'Sent a video';
  }

  if (!text) return 'No messages yet';
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
}

function getConversationDisplayName(conversation) {
  const otherUser = conversation?.otherUser || {};
  return otherUser.nickname || otherUser.display_name || 'Unknown user';
}

function readCachedConversations() {
  try {
    const raw = localStorage.getItem('zap_cached_conversations') || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeCachedConversations(conversations) {
  try {
    localStorage.setItem('zap_cached_conversations', JSON.stringify(conversations || []));
  } catch (_) {
    // Ignore storage quota/errors; cache is best-effort only.
  }
}

function applyThemeFromConversation(conversation) {
  if (!conversation || !conversation.theme_gradient) return;

  window.currentTheme = {
    name: conversation.theme_name || 'custom',
    gradient: conversation.theme_gradient
  };

  if (typeof applyThemePreview === 'function') {
    applyThemePreview(conversation.theme_gradient);
  }
}

function renderConversationList(conversations) {
  const container = document.getElementById('chat-list');
  if (!container) return;

  if (!conversations || !conversations.length) {
    container.innerHTML =
      '<div style="padding:14px 20px;font-size:12px;color:var(--text3)">No conversations yet.</div>';
    return;
  }

  container.innerHTML = conversations
    .map((conversation) => {
      const otherUser = conversation.otherUser || {};
      const conversationId = escapeHtml(conversation.id);
      const displayName = escapeHtml(getConversationDisplayName(conversation));
      const preview = escapeHtml(getConversationPreview(conversation));
      const timeLabel = escapeHtml(
        formatChatTimeLabel(conversation.updated_at || conversation.lastMessage?.created_at)
      );
      const avatar = escapeHtml(getInitialAvatar(otherUser.display_name || displayName));
      const onlineDot = otherUser.is_online ? '<div class="online-dot"></div>' : '';
      const unreadCount = Number(conversation.unreadCount || 0);
      const unreadClass = unreadCount > 0 ? ' unread' : '';
      const unreadBadge = unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : '';

      return `
        <div class="chat-item${unreadClass}" data-conversation-id="${conversationId}">
          <div class="avatar" style="background:linear-gradient(135deg,#7c6bff22,#a78bfa22)"><span>${avatar}</span>${onlineDot}</div>
          <div class="chat-info"><div class="chat-name">${displayName}</div><div class="chat-preview">${preview}</div></div>
          <div class="chat-meta"><div class="chat-time">${timeLabel}</div>${unreadBadge}</div>
        </div>
      `;
    })
    .join('');
}

function renderConversationListLoadingState() {
  const container = document.getElementById('chat-list');
  if (!container) return;

  container.innerHTML = `
    <div class="chat-loading-wrap" aria-live="polite" aria-busy="true">
      <div class="chat-loading-item"></div>
      <div class="chat-loading-item"></div>
      <div class="chat-loading-item"></div>
    </div>
  `;
}

function upsertConversationFromIncomingMessage(payload) {
  const conversationId = payload?.conversation_id || payload?.conversationId;
  if (!conversationId) return;

  const currentUserId = getCurrentSessionUserId();
  const senderId = payload?.sender_id || null;
  const isFromCurrentUser = Boolean(currentUserId && senderId === currentUserId);

  const existingList = Array.isArray(window.conversations) ? window.conversations : [];
  const existing = existingList.find((c) => c.id === conversationId);

  if (!existing) {
    loadConversations();
    return;
  }

  existing.lastMessage = {
    id: payload.id,
    content: payload.content || '',
    content_type: payload.content_type || (payload.mediaUrl ? 'image' : 'text'),
    created_at: payload.created_at || new Date().toISOString()
  };
  existing.updated_at = payload.created_at || new Date().toISOString();

  if (!isFromCurrentUser && window.activeConversationId !== conversationId) {
    existing.unreadCount = Number(existing.unreadCount || 0) + 1;
  }

  if (window.activeConversationId === conversationId) {
    existing.unreadCount = 0;
  }

  const reordered = [existing, ...existingList.filter((c) => c.id !== conversationId)];
  window.conversations = reordered;
  renderConversationList(reordered);
}

function markMessagesAsRead(conversationId, messages) {
  const currentUserId = getCurrentSessionUserId();
  if (!currentUserId || !conversationId || !Array.isArray(messages) || !messages.length) {
    return;
  }

  const unreadIds = messages
    .filter((msg) => {
      const senderId = msg.sender_id || msg.sender?.id;
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      return senderId !== currentUserId && !readBy.includes(currentUserId);
    })
    .map((msg) => msg.id)
    .filter(Boolean);

  if (!unreadIds.length) {
    return;
  }

  emitSocketEvent('message:read', {
    conversationId,
    messageIds: unreadIds
  });
}

async function loadConversations() {
  const token = getSocketToken();
  if (!token) {
    renderConversationList([]);
    window.conversations = [];
    return;
  }

  const cached = readCachedConversations();
  if (cached.length) {
    window.conversations = cached.map((conversation) => ({
      ...conversation,
      unreadCount: Number(conversation.unreadCount || conversation.unread_count || 0)
    }));
    renderConversationList(window.conversations);
  } else {
    renderConversationListLoadingState();
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/conversations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json();
    if (!response.ok) {
      renderConversationList([]);
      window.conversations = [];
      return;
    }

    window.conversations = (payload.conversations || []).map((conversation) => ({
      ...conversation,
      unreadCount: Number(conversation.unreadCount || conversation.unread_count || 0)
    }));
    writeCachedConversations(window.conversations);
    renderConversationList(window.conversations);
  } catch (_) {
    if (!window.conversations || !window.conversations.length) {
      renderConversationList([]);
      window.conversations = [];
    }
  }
}

async function fetchConversationMessages(conversationId) {
  const token = getSocketToken();
  if (!token) {
    return [];
  }

  const response = await fetch(`${getApiBaseUrl()}/api/conversations/${conversationId}/messages`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    const code = payload?.code ? `[${payload.code}] ` : '';
    throw new Error(`${code}${payload?.message || 'Failed to load messages'}`);
  }

  return payload.messages || [];
}

async function fetchConversationDetails(conversationId) {
  const token = getSocketToken();
  if (!token) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/conversations/${conversationId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    const code = payload?.code ? `[${payload.code}] ` : '';
    throw new Error(`${code}${payload?.message || 'Failed to load conversation details'}`);
  }

  return payload;
}

async function openConversationById(conversationId) {
  let conversation = (window.conversations || []).find((item) => item.id === conversationId);

  // Newly created/recreated conversations may exist without enriched otherUser details in client state.
  if (!conversation || !conversation.otherUser?.display_name) {
    try {
      const detailedConversation = await fetchConversationDetails(conversationId);
      if (detailedConversation?.id) {
        const list = Array.isArray(window.conversations) ? [...window.conversations] : [];
        const index = list.findIndex((item) => item.id === conversationId);
        if (index >= 0) {
          list[index] = {
            ...list[index],
            ...detailedConversation,
            otherUser: {
              ...(list[index].otherUser || {}),
              ...(detailedConversation.otherUser || {})
            }
          };
        } else {
          list.unshift(detailedConversation);
        }
        window.conversations = list;
        renderConversationList(window.conversations);
        conversation = list.find((item) => item.id === conversationId) || detailedConversation;
      }
    } catch (error) {
      console.warn('[chat] failed loading conversation details:', error?.message || error);
    }
  }

  const otherUser = conversation?.otherUser || {};

  const chatName = document.getElementById('chat-name');
  if (chatName) {
    chatName.textContent = getConversationDisplayName(conversation || {});
  }

  const chatAvatar = document.getElementById('chat-av');
  if (chatAvatar) {
    chatAvatar.textContent = getInitialAvatar(otherUser.display_name || 'C');
  }

  const chatStatus = document.getElementById('chat-status');
  if (chatStatus) {
    chatStatus.textContent = otherUser.is_online ? '● Active now' : '● Offline';
  }

  applyThemeFromConversation(conversation);

  navigate('view-chat');

  window.activeConversationId = conversationId;
  joinConversation(conversationId);

  if (typeof window.renderConversationLoadingState === 'function') {
    window.renderConversationLoadingState();
  }

  try {
    const messages = await fetchConversationMessages(conversationId);
    if (typeof window.renderConversationMessages === 'function') {
      window.renderConversationMessages(messages);
    }

    if (isConversationCurrentlyVisibleOnScreen(conversationId)) {
      markMessagesAsRead(conversationId, messages);
    }

    const existing = (window.conversations || []).find((item) => item.id === conversationId);
    if (existing) {
      existing.unreadCount = 0;
      renderConversationList(window.conversations);
    }
  } catch (error) {
    if (typeof window.renderConversationMessages === 'function') {
      window.renderConversationMessages([]);
    }
    console.warn('[chat] failed loading messages:', error?.message || error);
  }
}

function initSocket() {
  ensureAppForegroundTracking();

  if (typeof io === 'undefined') {
    console.warn('[socket] socket.io client library not loaded');
    return;
  }

  const token = getSocketToken();
  const socketUrl = window.ZAP_SOCKET_URL || 'http://localhost:3000';

  window.appSocket = io(socketUrl, {
    query: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  window.appSocket.on('connect', () => {
    console.log('[socket] connected', window.appSocket.id);
    loadConversations();
  });

  window.appSocket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err.message);
    if (!token) {
      console.warn('[socket] No JWT found. Save one with connectSocketWithToken(token).');
    }
  });

  window.appSocket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  window.appSocket.on('message:received', (payload) => {
    console.log('[socket] message:received', payload);
    upsertConversationFromIncomingMessage(payload);

    if (typeof window.notifyIncomingMessage === 'function') {
      window.notifyIncomingMessage(payload);
    }

    const conversationId = payload?.conversation_id || payload?.conversationId;
    const currentUserId = getCurrentSessionUserId();
    const senderId = payload?.sender_id || null;

    if (
      conversationId &&
      payload?.id &&
      senderId &&
      senderId !== currentUserId &&
      isConversationCurrentlyVisibleOnScreen(conversationId)
    ) {
      emitSocketEvent('message:read', {
        conversationId,
        messageIds: [payload.id]
      });
    }

    if (typeof window.handleIncomingSocketMessage === 'function') {
      window.handleIncomingSocketMessage(payload);
    }
  });

  window.appSocket.on('message:typing', (payload) => {
    if (typeof window.showRemoteTypingIndicator === 'function') {
      window.showRemoteTypingIndicator(payload);
    }
  });

  window.appSocket.on('message:typing_stop', (payload) => {
    if (typeof window.hideRemoteTypingIndicator === 'function') {
      window.hideRemoteTypingIndicator(payload);
    }
  });

  window.appSocket.on('message:read_receipt', (payload) => {
    if (typeof window.handleMessageReadReceipt === 'function') {
      window.handleMessageReadReceipt(payload);
    }
  });

  window.appSocket.on('conversation:joined', (payload) => {
    console.log('[socket] conversation:joined', payload);
    if (payload?.conversationId) {
      window.activeConversationId = payload.conversationId;
    }
  });

  window.appSocket.on('user:presence_update', (payload) => {
    console.log('[socket] user:presence_update', payload);
  });

  window.appSocket.on('conversation:theme_updated', (payload) => {
    const conversationId = payload?.conversationId;
    if (!conversationId) return;

    const conversation = (window.conversations || []).find((item) => item.id === conversationId);
    if (conversation) {
      conversation.theme_name = payload.themeName || conversation.theme_name;
      conversation.theme_gradient = payload.themeGradient || conversation.theme_gradient;
    }

    if (window.activeConversationId === conversationId) {
      applyThemeFromConversation(conversation || {
        theme_name: payload.themeName,
        theme_gradient: payload.themeGradient
      });
    }
  });

  window.appSocket.on('friendship:request_received', (payload) => {
    console.log('[socket] friendship:request_received', payload);
    if (typeof window.handleFriendRequestReceived === 'function') {
      window.handleFriendRequestReceived(payload);
    }
  });

  window.appSocket.on('friendship:request_accepted', (payload) => {
    console.log('[socket] friendship:request_accepted', payload);

    const autoConversationId = payload?.conversation?.id;
    if (autoConversationId) {
      joinConversation(autoConversationId);
      loadConversations();
    } else if (payload?.userId && typeof window.createAndJoinConversation === 'function') {
      // Backward-compatible fallback for older payloads that only contain userId.
      window.createAndJoinConversation(payload.userId).catch((err) => {
        console.warn('[socket] auto conversation create failed:', err?.message || err);
      });
    }

    if (typeof window.handleFriendRequestAccepted === 'function') {
      window.handleFriendRequestAccepted(payload);
    }
  });

  window.appSocket.on('friendship:request_declined', (payload) => {
    console.log('[socket] friendship:request_declined', payload);
  });

  window.appSocket.on('error', (payload) => {
    if (payload?.code || payload?.message) {
      console.warn('[socket] event error', payload);
    }
  });

  const syncReadsIfVisible = async () => {
    const conversationId = window.activeConversationId;
    if (!isConversationCurrentlyVisibleOnScreen(conversationId)) return;

    try {
      const messages = await fetchConversationMessages(conversationId);
      markMessagesAsRead(conversationId, messages);
    } catch (_) {
      // Ignore transient fetch errors during app focus transitions.
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncReadsIfVisible();
    }
  });

  window.addEventListener('focus', () => {
    syncReadsIfVisible();
  });
}

function connectSocketWithToken(token) {
  if (window.appSocket) {
    window.appSocket.disconnect();
  }
  initSocket();
}

function reconnectSocket() {
  if (window.appSocket) {
    window.appSocket.disconnect();
  }
  initSocket();
}

async function createConversationWithUser(withUserId) {
  const token = getSocketToken();

  if (!token) {
    throw new Error('Missing JWT. Call connectSocketWithToken(token) first.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ withUserId })
  });

  const payload = await response.json();

  if (!response.ok) {
    const code = payload?.code ? `[${payload.code}] ` : '';
    throw new Error(`${code}${payload?.message || 'Failed to create conversation'}`);
  }

  return payload;
}

async function createAndJoinConversation(withUserId) {
  const conversation = await createConversationWithUser(withUserId);

  if (conversation?.id) {
    window.activeConversationId = conversation.id;
    joinConversation(conversation.id);
    loadConversations();
  }

  return conversation;
}

function joinConversation(conversationId) {
  window.activeConversationId = conversationId;
  emitSocketEvent('conversation:join', { conversationId });
}

function leaveConversation(conversationId) {
  if (typeof window.pauseAllInlineChatVideos === 'function') {
    window.pauseAllInlineChatVideos();
  }

  if (window.activeConversationId === conversationId) {
    window.activeConversationId = null;
  }
  emitSocketEvent('conversation:leave', { conversationId });
}

function emitSocketEvent(eventName, payload) {
  if (!window.appSocket || !window.appSocket.connected) {
    console.warn('[socket] not connected');
    return;
  }

  window.appSocket.emit(eventName, payload);
}

window.initSocket = initSocket;
window.connectSocketWithToken = connectSocketWithToken;
window.reconnectSocket = reconnectSocket;
window.loadConversations = loadConversations;
window.openConversationById = openConversationById;
window.createConversationWithUser = createConversationWithUser;
window.createAndJoinConversation = createAndJoinConversation;
window.joinConversation = joinConversation;
window.leaveConversation = leaveConversation;
window.emitSocketEvent = emitSocketEvent;

document.addEventListener('click', (event) => {
  const row = event.target.closest('[data-conversation-id]');
  if (!row) return;

  const conversationId = row.getAttribute('data-conversation-id');
  if (!conversationId) return;

  openConversationById(conversationId);
});
