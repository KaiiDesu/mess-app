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

window.userPresenceById = window.userPresenceById || {};
let activeConversationSwipeRow = null;
let conversationSwipePointer = null;
let suppressConversationClickUntil = 0;
let conversationsRefreshTimer = null;
let conversationsRefreshInFlight = null;
let lastConversationsRefreshAt = 0;
let conversationsLoadRequestId = 0;
let conversationsLoadAppliedRequestId = 0;

const CONVERSATION_SWIPE_ACTION_WIDTH = 240;
const CONVERSATION_SWIPE_HAPTIC_SUPPORTED = Boolean(navigator.vibrate);
const CONVERSATIONS_REFRESH_INTERVAL_MS = 12000;
const CONVERSATIONS_REFRESH_MIN_GAP_MS = 3000;
const NETWORK_REQUEST_TIMEOUT_MS = 12000;

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = NETWORK_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and backend URL.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

function normalizePresenceStatus(rawStatus, fallbackIsOnline) {
  const normalized = String(rawStatus || '').toLowerCase();
  if (normalized === 'online' || normalized === 'away' || normalized === 'offline' || normalized === 'dnd') {
    return normalized;
  }
  return fallbackIsOnline ? 'online' : 'offline';
}

function getUserPresenceStatus(userId, fallbackIsOnline) {
  if (userId && window.userPresenceById[userId]) {
    return normalizePresenceStatus(window.userPresenceById[userId], fallbackIsOnline);
  }
  return normalizePresenceStatus('', fallbackIsOnline);
}

function getPresenceStatusLabel(status) {
  const normalized = normalizePresenceStatus(status);
  if (normalized === 'online') return 'Online';
  if (normalized === 'away') return 'Away';
  if (normalized === 'dnd') return 'Do not disturb';
  return 'Offline';
}

function getPresenceDotClass(status) {
  const normalized = normalizePresenceStatus(status);
  if (normalized === 'away') return 'away';
  if (normalized === 'dnd') return 'dnd';
  return 'online';
}

function setChatHeaderPresenceStatus(status) {
  const chatStatus = document.getElementById('chat-status');
  if (!chatStatus) return;
  chatStatus.textContent = `● ${getPresenceStatusLabel(status)}`;
}

function getConversationSwipeTrack(row) {
  return row?.querySelector('.chat-swipe-body') || null;
}

function closeConversationSwipe(row = activeConversationSwipeRow, force = false) {
  const targetRow = row || activeConversationSwipeRow;
  if (!targetRow) return;

  const track = getConversationSwipeTrack(targetRow);
  if (track) {
    track.style.transform = 'translateX(0px)';
  }
  targetRow.classList.remove('is-swiped');

  if (activeConversationSwipeRow === targetRow || force) {
    activeConversationSwipeRow = null;
  }
}

function openConversationSwipe(row) {
  if (!row) return;

  if (activeConversationSwipeRow && activeConversationSwipeRow !== row) {
    closeConversationSwipe(activeConversationSwipeRow, true);
  }

  const track = getConversationSwipeTrack(row);
  if (!track) return;

  track.style.transform = `translateX(${-CONVERSATION_SWIPE_ACTION_WIDTH}px)`;
  row.classList.add('is-swiped');
  activeConversationSwipeRow = row;

  if (CONVERSATION_SWIPE_HAPTIC_SUPPORTED) {
    navigator.vibrate(10);
  }
}

function setConversationSwipeOffset(row, offsetPx) {
  const track = getConversationSwipeTrack(row);
  if (!track) return;

  const clamped = Math.max(-CONVERSATION_SWIPE_ACTION_WIDTH, Math.min(0, offsetPx));
  track.style.transform = `translateX(${clamped}px)`;
}

function findConversationFromRow(row) {
  const conversationId = row?.dataset?.conversationId;
  if (!conversationId) return null;
  return (window.conversations || []).find((item) => item.id === conversationId) || null;
}

function removeConversationFromState(conversationId) {
  if (!conversationId) return;

  window.conversations = (window.conversations || []).filter((item) => item.id !== conversationId);
  writeCachedConversations(window.conversations);
  renderConversationList(window.conversations);

  if (window.activeConversationId === conversationId) {
    window.activeConversationId = null;
    if (typeof navigate === 'function') {
      navigate('view-home');
    }
  }
}

function updateConversationListConversation(conversationId, updater) {
  if (!conversationId || typeof updater !== 'function') return;

  const list = Array.isArray(window.conversations) ? [...window.conversations] : [];
  const index = list.findIndex((item) => item.id === conversationId);
  if (index < 0) return;

  list[index] = updater(list[index]);
  window.conversations = list;
  writeCachedConversations(list);
  renderConversationList(list);
}

async function deleteConversationFromList(conversationId) {
  const token = getSocketToken();
  if (!token || !conversationId) return false;

  const response = await fetch(`${getApiBaseUrl()}/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || 'Failed to delete conversation';
    window.alert(message);
    return false;
  }

  return true;
}

function applyConversationSwipeAction(conversationId, action) {
  const conversation = (window.conversations || []).find((item) => item.id === conversationId);
  if (!conversation) return;

  if (action === 'archive') {
    if (window.appSocket?.connected) {
      emitSocketEvent('conversation:archive', { conversationId, isArchived: true });
    }
    removeConversationFromState(conversationId);
    return;
  }

      localStorage.getItem('token') ||
  if (action === 'restrict') {
    if (window.appSocket?.connected) {
      emitSocketEvent('conversation:mute', { conversationId });
    }
    updateConversationListConversation(conversationId, (item) => ({
      ...item,
      is_muted: true
    }));
    return;
  }

  if (action === 'delete') {
    deleteConversationFromList(conversationId).then((success) => {
      if (success) {
        removeConversationFromState(conversationId);
      }
    });
  }
}

function attachConversationListInteractions(container) {
  if (!container || container.__zapSwipeHandlersAttached) return;

  const state = {
    row: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    tracking: false,
    openedBySwipe: false
  };

  const cancelTracking = () => {
    if (!state.row) return;

    const shouldOpen = state.currentX <= -CONVERSATION_SWIPE_ACTION_WIDTH * 0.35;
    if (shouldOpen) {
      openConversationSwipe(state.row);
      suppressConversationClickUntil = Date.now() + 250;
    } else {
      closeConversationSwipe(state.row);
      suppressConversationClickUntil = Date.now() + 250;
    }

    state.row = null;
    state.pointerId = null;
    state.tracking = false;
    state.openedBySwipe = false;
  };

  container.addEventListener('pointerdown', (event) => {
    const body = event.target.closest('.chat-swipe-body');
    if (!body || !container.contains(body)) return;

    const row = body.closest('.chat-item');
    const track = getConversationSwipeTrack(row);
    if (!row || !track) return;

    if (event.button !== 0 && event.pointerType !== 'touch') return;

    if (activeConversationSwipeRow && activeConversationSwipeRow !== row) {
      closeConversationSwipe(activeConversationSwipeRow, true);
    }

    state.row = row;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.currentX = 0;
    state.tracking = true;
    state.openedBySwipe = false;

    try {
      body.setPointerCapture(event.pointerId);
    } catch (_) {
      // Ignore capture errors on unsupported hosts.
    }
  });

  container.addEventListener('pointermove', (event) => {
    if (!state.tracking || !state.row || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - state.startX;
    const dy = Math.abs(event.clientY - state.startY);

    if (Math.abs(dx) < 10 && dy < 10) return;
    if (dy > 18 && Math.abs(dx) < 14) {
      cancelTracking();
      return;
    }

    if (dx >= 0) {
      state.currentX = 0;
      setConversationSwipeOffset(state.row, 0);
      return;
    }

    state.currentX = dx;
    setConversationSwipeOffset(state.row, dx);
    event.preventDefault();
  }, { passive: false });

  container.addEventListener('pointerup', (event) => {
    if (!state.tracking || event.pointerId !== state.pointerId) return;
    cancelTracking();
  });

  container.addEventListener('pointercancel', (event) => {
    if (!state.tracking || event.pointerId !== state.pointerId) return;
    closeConversationSwipe(state.row);
    state.row = null;
    state.pointerId = null;
    state.tracking = false;
    state.openedBySwipe = false;
  });

  container.addEventListener('click', (event) => {
    const actionButton = event.target.closest('.chat-swipe-action-btn');
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      const row = actionButton.closest('.chat-item');
      const conversationId = row?.dataset?.conversationId;
      const action = actionButton.dataset.action;

      closeConversationSwipe(row);
      suppressConversationClickUntil = Date.now() + 250;
      applyConversationSwipeAction(conversationId, action);
      return;
    }

    const row = event.target.closest('.chat-item');
    if (!row || !container.contains(row)) return;
    if (Date.now() < suppressConversationClickUntil) return;

    if (row.classList.contains('is-swiped')) {
      closeConversationSwipe(row);
      return;
    }

    const conversationId = row.dataset.conversationId;
    if (conversationId && typeof openConversationById === 'function') {
      openConversationById(conversationId);
    }
  });

  container.addEventListener('scroll', () => {
    if (activeConversationSwipeRow) {
      closeConversationSwipe(activeConversationSwipeRow, true);
    }
  }, { passive: true });

  container.__zapSwipeHandlersAttached = true;
}

function updateActiveChatHeaderPresence() {
  if (!window.activeConversationId) return;
  const conversation = (window.conversations || []).find((item) => item.id === window.activeConversationId);
  const otherUser = conversation?.otherUser || {};
  const status = getUserPresenceStatus(otherUser.id, otherUser.is_online);
  setChatHeaderPresenceStatus(status);
}

function syncPresenceToConversations(userId, status) {
  if (!userId || !Array.isArray(window.conversations)) return;

  window.conversations.forEach((conversation) => {
    if (conversation?.otherUser?.id === userId) {
      conversation.otherUser = {
        ...(conversation.otherUser || {}),
        is_online: status !== 'offline',
        presence_status: status
      };
    }
  });
}

function syncPresenceToAcceptedFriends(userId, status) {
  if (!userId || !Array.isArray(window.acceptedFriends)) return;

  window.acceptedFriends = window.acceptedFriends.map((friend) => {
    if (friend?.id !== userId) return friend;
    return {
      ...friend,
      is_online: status !== 'offline',
      presence_status: status
    };
  });
}

function emitPresenceAppState() {
  if (!window.appSocket || !window.appSocket.connected) return;
  window.appSocket.emit('presence:app_state', {
    foreground: isAppForeground(),
    networkOnline: navigator.onLine !== false
  });
}

function emitPresenceNetworkState() {
  if (!window.appSocket || !window.appSocket.connected) return;
  window.appSocket.emit('presence:network_state', {
    online: navigator.onLine !== false
  });
}

let presenceHeartbeatTimer = null;

function emitPresenceHeartbeat() {
  if (!window.appSocket || !window.appSocket.connected) return;
  window.appSocket.emit('presence:heartbeat', {
    foreground: isAppForeground(),
    networkOnline: navigator.onLine !== false
  });
}

function startPresenceHeartbeat() {
  if (presenceHeartbeatTimer) return;

  emitPresenceHeartbeat();
  presenceHeartbeatTimer = setInterval(() => {
    emitPresenceHeartbeat();
  }, 15000);
}

function stopPresenceHeartbeat() {
  if (!presenceHeartbeatTimer) return;
  clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = null;
}

function ensureAppForegroundTracking() {
  if (window.__zapForegroundTrackingInitialized) return;
  window.__zapForegroundTrackingInitialized = true;

  setAppForeground(true);
  setReadReceiptsEnabled(true);

  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    setAppForeground(visible);
    if (visible) {
      setReadReceiptsEnabled(true);
    }
    emitPresenceAppState();
    emitPresenceHeartbeat();
    if (!visible) {
      setReadReceiptsEnabled(false);
    }
  });

  // Mobile webviews and desktop browsers can differ in which lifecycle events fire.
  window.addEventListener('focus', () => {
    setAppForeground(true);
    setReadReceiptsEnabled(true);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });
  window.addEventListener('blur', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });
  window.addEventListener('pageshow', () => {
    setAppForeground(true);
    setReadReceiptsEnabled(true);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });
  window.addEventListener('pagehide', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });

  document.addEventListener('resume', () => {
    setAppForeground(true);
    setReadReceiptsEnabled(true);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });
  document.addEventListener('pause', () => {
    setAppForeground(false);
    setReadReceiptsEnabled(false);
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });

  window.addEventListener('online', () => {
    setReadReceiptsEnabled(true);
    emitPresenceNetworkState();
    emitPresenceAppState();
    emitPresenceHeartbeat();
  });
  window.addEventListener('offline', () => {
    emitPresenceNetworkState();
    emitPresenceAppState();
    emitPresenceHeartbeat();
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

function parseServerDateToDeviceLocal(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return new Date(NaN);

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  return new Date(candidate);
}

function formatChatTimeLabel(isoDate) {
  if (!isoDate) return '';

  const date = parseServerDateToDeviceLocal(isoDate);
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
  const currentUserId = getCurrentSessionUserId();
  const isSeenOwnLastMessage = Boolean(
    lastMessage?.sender_id &&
      currentUserId &&
      lastMessage.sender_id === currentUserId &&
      lastMessage.is_seen_by_other
  );

  const withSeenPrefix = (preview) => (isSeenOwnLastMessage ? `Sent: ${preview}` : preview);

  if (contentType === 'image' || String(text).startsWith('data:image/')) {
    return withSeenPrefix('Sent a photo');
  }

  if (contentType === 'video' || String(text).startsWith('data:video/')) {
    return withSeenPrefix('Sent a video');
  }

  if (!text) return 'No messages yet';
  const preview = text.length > 48 ? `${text.slice(0, 48)}...` : text;
  return withSeenPrefix(preview);
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

function applyConversationNicknameUpdate(payload) {
  const conversationId = payload?.conversationId;
  const targetUserId = payload?.targetUserId;
  if (!conversationId || !targetUserId) return;

  const conversation = (window.conversations || []).find((item) => item.id === conversationId);
  if (!conversation) return;

  if (conversation?.otherUser?.id === targetUserId) {
    conversation.otherUser = {
      ...(conversation.otherUser || {}),
      nickname: payload?.nickname || null
    };

    writeCachedConversations(window.conversations);
    renderConversationList(window.conversations);

    if (window.activeConversationId === conversationId) {
      const chatName = document.getElementById('chat-name');
      if (chatName) {
        chatName.textContent = getConversationDisplayName(conversation);
      }

      const settingsName = document.getElementById('conv-settings-name');
      if (settingsName) {
        settingsName.textContent = getConversationDisplayName(conversation);
      }
    }
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
      const status = getUserPresenceStatus(otherUser.id, otherUser.is_online);
      const onlineDot =
        status !== 'offline' ? `<div class="online-dot ${escapeHtml(getPresenceDotClass(status))}"></div>` : '';
      const unreadCount = Number(conversation.unreadCount || 0);
      const unreadClass = unreadCount > 0 ? ' unread' : '';
      const unreadBadge = unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : '';
      const isMuted = Boolean(conversation.is_muted);
      const muteLabel = isMuted ? '<div class="chat-pill muted">Restricted</div>' : '';

      return `
        <div class="chat-item${unreadClass}" data-conversation-id="${conversationId}">
          <div class="chat-swipe-actions" aria-hidden="true">
            <button type="button" class="chat-swipe-action-btn archive" data-action="archive">Archive</button>
            <button type="button" class="chat-swipe-action-btn restrict" data-action="restrict">Restrict</button>
            <button type="button" class="chat-swipe-action-btn delete" data-action="delete">Delete</button>
          </div>
          <div class="chat-swipe-body">
            <div class="avatar" style="background:linear-gradient(135deg,#7c6bff22,#a78bfa22)"><span>${avatar}</span>${onlineDot}</div>
            <div class="chat-info"><div class="chat-name">${displayName}</div><div class="chat-preview">${preview}</div></div>
            <div class="chat-meta"><div class="chat-time">${timeLabel}</div>${muteLabel}${unreadBadge}</div>
          </div>
        </div>
      `;
    })
    .join('');

  attachConversationListInteractions(container);
  closeConversationSwipe(activeConversationSwipeRow, true);
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
    sender_id: senderId,
    content: payload.content || '',
    content_type: payload.content_type || (payload.mediaUrl ? 'image' : 'text'),
    created_at: payload.created_at || new Date().toISOString(),
    is_seen_by_other: false
  };
  existing.updated_at = payload.created_at || new Date().toISOString();

  const isViewingThisConversation =
    currentView === 'view-chat' && window.activeConversationId === conversationId;

  if (!isFromCurrentUser && !isViewingThisConversation) {
    existing.unreadCount = Number(existing.unreadCount || 0) + 1;
  }

  if (isViewingThisConversation) {
    existing.unreadCount = 0;
  }

  const reordered = [existing, ...existingList.filter((c) => c.id !== conversationId)];
  window.conversations = reordered;
  renderConversationList(reordered);
}

function applyConversationSeenStateFromReadReceipt(payload) {
  const conversationId = payload?.conversationId;
  const messageIds = Array.isArray(payload?.messageIds) ? payload.messageIds : [];
  if (!conversationId || !messageIds.length) return;

  const currentUserId = getCurrentSessionUserId();
  if (!currentUserId) return;

  const conversations = Array.isArray(window.conversations) ? window.conversations : [];
  const conversation = conversations.find((item) => item.id === conversationId);
  const lastMessage = conversation?.lastMessage;
  if (!conversation || !lastMessage?.id) return;
  if (lastMessage.sender_id !== currentUserId) return;
  if (!messageIds.includes(lastMessage.id)) return;
  if (lastMessage.is_seen_by_other) return;

  conversation.lastMessage = {
    ...lastMessage,
    is_seen_by_other: true
  };

  writeCachedConversations(window.conversations);
  renderConversationList(window.conversations);
}

function syncConversationLastMessageSeenStateFromMessages(conversationId, messages) {
  if (!conversationId || !Array.isArray(messages)) return;

  const conversation = (window.conversations || []).find((item) => item.id === conversationId);
  const lastMessage = conversation?.lastMessage;
  if (!conversation || !lastMessage?.id) return;

  const currentUserId = getCurrentSessionUserId();
  const otherUserId = conversation?.otherUser?.id;
  if (!currentUserId || !otherUserId) return;

  if (lastMessage.sender_id !== currentUserId) {
    if (lastMessage.is_seen_by_other) {
      conversation.lastMessage = {
        ...lastMessage,
        is_seen_by_other: false
      };
      writeCachedConversations(window.conversations);
      renderConversationList(window.conversations);
    }
    return;
  }

  const matched = messages.find((msg) => msg?.id === lastMessage.id);
  const readBy = Array.isArray(matched?.readBy) ? matched.readBy : [];
  const isSeenByOther = readBy.includes(otherUserId);

  if (Boolean(lastMessage.is_seen_by_other) === isSeenByOther) return;

  conversation.lastMessage = {
    ...lastMessage,
    is_seen_by_other: isSeenByOther
  };

  writeCachedConversations(window.conversations);
  renderConversationList(window.conversations);
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

async function loadConversations(options = {}) {
  const useCache = options.useCache !== false;
  const requestId = ++conversationsLoadRequestId;
  const token = getSocketToken();
  if (!token) {
    renderConversationList([]);
    window.conversations = [];
    return;
  }

  if (useCache) {
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
  }

  try {
    const { response, payload } = await fetchJsonWithTimeout(`${getApiBaseUrl()}/api/conversations`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (requestId < conversationsLoadAppliedRequestId) {
        return;
      }
      conversationsLoadAppliedRequestId = requestId;
      renderConversationList([]);
      window.conversations = [];
      return;
    }

    if (requestId < conversationsLoadAppliedRequestId) {
      return;
    }
    conversationsLoadAppliedRequestId = requestId;

    window.conversations = (payload.conversations || []).map((conversation) => ({
      ...conversation,
      unreadCount: Number(conversation.unreadCount || conversation.unread_count || 0)
    }));
    window.conversations.forEach((conversation) => {
      const otherUser = conversation?.otherUser;
      if (otherUser?.id && !window.userPresenceById[otherUser.id]) {
        window.userPresenceById[otherUser.id] = normalizePresenceStatus(
          otherUser.presence_status,
          otherUser.is_online
        );
      }
    });
    writeCachedConversations(window.conversations);
    renderConversationList(window.conversations);
  } catch (_) {
    if (requestId < conversationsLoadAppliedRequestId) {
      return;
    }

    if (!window.conversations || !window.conversations.length) {
      conversationsLoadAppliedRequestId = requestId;
      renderConversationList([]);
      window.conversations = [];
    }
  }
}

function shouldRunPeriodicConversationRefresh() {
  if (!getSocketToken()) return false;
  if (!isAppForeground()) return false;
  if (navigator.onLine === false) return false;
  if (typeof currentView !== 'undefined' && currentView === 'view-login') return false;
  return true;
}

async function refreshConversationsPeriodically(force = false) {
  if (!force && !shouldRunPeriodicConversationRefresh()) {
    return;
  }

  const now = Date.now();
  if (!force && now - lastConversationsRefreshAt < CONVERSATIONS_REFRESH_MIN_GAP_MS) {
    return;
  }

  if (conversationsRefreshInFlight) {
    return conversationsRefreshInFlight;
  }

  lastConversationsRefreshAt = now;
  conversationsRefreshInFlight = loadConversations({ useCache: false }).finally(() => {
    conversationsRefreshInFlight = null;
  });

  return conversationsRefreshInFlight;
}

function startConversationsRefreshLoop() {
  if (conversationsRefreshTimer) return;

  conversationsRefreshTimer = setInterval(() => {
    refreshConversationsPeriodically(false);
  }, CONVERSATIONS_REFRESH_INTERVAL_MS);
}

function stopConversationsRefreshLoop() {
  if (!conversationsRefreshTimer) return;
  clearInterval(conversationsRefreshTimer);
  conversationsRefreshTimer = null;
}

async function fetchConversationMessages(conversationId) {
  const token = getSocketToken();
  if (!token) {
    return [];
  }

  const { response, payload } = await fetchJsonWithTimeout(
    `${getApiBaseUrl()}/api/conversations/${conversationId}/messages`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

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

  const { response, payload } = await fetchJsonWithTimeout(
    `${getApiBaseUrl()}/api/conversations/${conversationId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

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
    setChatHeaderPresenceStatus(getUserPresenceStatus(otherUser.id, otherUser.is_online));
  }

  applyThemeFromConversation(conversation);

  navigate('view-chat');

  window.activeConversationId = conversationId;
  joinConversation(conversationId);

  window.__zapConversationMessagesLoadingId = conversationId;
  const loadingTimer =
    typeof window.renderConversationLoadingState === 'function'
      ? setTimeout(() => {
          if (window.__zapConversationMessagesLoadingId !== conversationId) return;
          window.renderConversationLoadingState();
        }, 220)
      : null;

  try {
    const messages = await fetchConversationMessages(conversationId);
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
    if (typeof window.renderConversationMessages === 'function') {
      window.renderConversationMessages(messages);
    }

    syncConversationLastMessageSeenStateFromMessages(conversationId, messages);

    if (isConversationCurrentlyVisibleOnScreen(conversationId)) {
      markMessagesAsRead(conversationId, messages);
    }

    const existing = (window.conversations || []).find((item) => item.id === conversationId);
    if (existing) {
      existing.unreadCount = 0;
      renderConversationList(window.conversations);
    }
  } catch (error) {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
    if (typeof window.renderConversationMessages === 'function') {
      window.renderConversationMessages([]);
    }
    console.warn('[chat] failed loading messages:', error?.message || error);
  } finally {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }

    if (window.__zapConversationMessagesLoadingId === conversationId) {
      window.__zapConversationMessagesLoadingId = null;
    }

    if (typeof window.flushQueuedIncomingMessagesForConversation === 'function') {
      window.flushQueuedIncomingMessagesForConversation(conversationId);
    }
  }
}

let inboundMessageQueue = [];
let inboundMessageFlushRafId = 0;
let inboundMessageFlushFallbackId = 0;
let lastInboundMessageAt = 0;
let inboundBurstModeUntil = 0;

function nowForInboundQueue() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function compareInboundPayloadChronologically(a, b) {
  const aTime = parseServerDateToDeviceLocal(a?.created_at || a?.createdAt || '').getTime() || 0;
  const bTime = parseServerDateToDeviceLocal(b?.created_at || b?.createdAt || '').getTime() || 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  const aId = String(a?.id || a?.clientMessageId || '');
  const bId = String(b?.id || b?.clientMessageId || '');
  return aId.localeCompare(bId);
}

function noteInboundMessageTraffic() {
  const now = nowForInboundQueue();
  if (now - lastInboundMessageAt <= 100) {
    inboundBurstModeUntil = now + 550;
  }
  lastInboundMessageAt = now;
}

function isInboundBurstModeActive() {
  return nowForInboundQueue() < inboundBurstModeUntil;
}

function cancelInboundFlushTimers() {
  if (inboundMessageFlushRafId) {
    cancelAnimationFrame(inboundMessageFlushRafId);
    inboundMessageFlushRafId = 0;
  }
  if (inboundMessageFlushFallbackId) {
    clearTimeout(inboundMessageFlushFallbackId);
    inboundMessageFlushFallbackId = 0;
  }
}

function processInboundMessagePayload(payload, pendingReadMap) {
  if (!payload) return;

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
    if (!pendingReadMap.has(conversationId)) {
      pendingReadMap.set(conversationId, []);
    }
    pendingReadMap.get(conversationId).push(payload.id);
  }

  if (typeof window.handleIncomingSocketMessage === 'function') {
    window.handleIncomingSocketMessage(payload);
  }
}

function flushInboundMessageQueue() {
  cancelInboundFlushTimers();
  if (!inboundMessageQueue.length) return;

  const batch = inboundMessageQueue.splice(0, inboundMessageQueue.length);
  batch.sort(compareInboundPayloadChronologically);

  const pendingReadMap = new Map();
  batch.forEach((payload) => {
    processInboundMessagePayload(payload, pendingReadMap);
  });

  pendingReadMap.forEach((messageIds, conversationId) => {
    const uniqueIds = [...new Set((messageIds || []).filter(Boolean))];
    if (!conversationId || !uniqueIds.length) return;

    emitSocketEvent('message:read', {
      conversationId,
      messageIds: uniqueIds
    });
  });

  if (inboundMessageQueue.length) {
    scheduleInboundQueueFlush();
  }
}

function scheduleInboundQueueFlush() {
  if (inboundMessageFlushRafId || inboundMessageFlushFallbackId) return;

  inboundMessageFlushRafId = requestAnimationFrame(() => {
    flushInboundMessageQueue();
  });

  // Background tabs/webviews may throttle rAF heavily; fallback keeps queue moving.
  inboundMessageFlushFallbackId = setTimeout(() => {
    flushInboundMessageQueue();
  }, 20);
}

function enqueueInboundMessagePayload(payload) {
  noteInboundMessageTraffic();
  inboundMessageQueue.push(payload);

  // Quiet traffic stays snappy: process first message immediately when not in burst mode.
  if (!isInboundBurstModeActive() && inboundMessageQueue.length === 1) {
    const pendingReadMap = new Map();
    const immediate = inboundMessageQueue.shift();
    processInboundMessagePayload(immediate, pendingReadMap);

    pendingReadMap.forEach((messageIds, conversationId) => {
      const uniqueIds = [...new Set((messageIds || []).filter(Boolean))];
      if (!conversationId || !uniqueIds.length) return;

      emitSocketEvent('message:read', {
        conversationId,
        messageIds: uniqueIds
      });
    });
    return;
  }

  scheduleInboundQueueFlush();
}

function initSocket() {
  ensureAppForegroundTracking();
  startConversationsRefreshLoop();

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
    refreshConversationsPeriodically(true);
    emitPresenceNetworkState();
    emitPresenceAppState();
    startPresenceHeartbeat();
    syncReadsIfVisible();
  });

  window.appSocket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err.message);
    if (!token) {
      console.warn('[socket] No JWT found. Save one with connectSocketWithToken(token).');
    }
  });

  window.appSocket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
    stopPresenceHeartbeat();
  });

  window.appSocket.on('message:received', (payload) => {
    console.log('[socket] message:received', payload);
    enqueueInboundMessagePayload(payload);
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
    applyConversationSeenStateFromReadReceipt(payload);
    if (typeof window.handleMessageReadReceipt === 'function') {
      window.handleMessageReadReceipt(payload);
    }
  });

  window.appSocket.on('message:reaction_added', (payload) => {
    if (typeof window.handleMessageReactionAdded === 'function') {
      window.handleMessageReactionAdded(payload);
    }
  });

  window.appSocket.on('message:reaction_removed', (payload) => {
    if (typeof window.handleMessageReactionRemoved === 'function') {
      window.handleMessageReactionRemoved(payload);
    }
  });

  window.appSocket.on('conversation:joined', (payload) => {
    console.log('[socket] conversation:joined', payload);
    if (payload?.conversationId) {
      window.activeConversationId = payload.conversationId;
    }
  });

  window.appSocket.on('user:presence_update', (payload) => {
    const userId = payload?.userId;
    if (!userId) return;

    const status = normalizePresenceStatus(payload?.status, payload?.is_online);
    window.userPresenceById[userId] = status;

    syncPresenceToConversations(userId, status);
    syncPresenceToAcceptedFriends(userId, status);
    updateActiveChatHeaderPresence();

    if (Array.isArray(window.conversations)) {
      renderConversationList(window.conversations);
    }

    if (typeof renderAcceptedFriends === 'function') {
      renderAcceptedFriends();
    }

    const conversation = (window.conversations || []).find((item) => item.id === window.activeConversationId);
    const activeOtherUserId = conversation?.otherUser?.id;
    if (activeOtherUserId && activeOtherUserId === userId) {
      const settingsStatus = document.getElementById('conv-settings-status');
      if (settingsStatus) {
        settingsStatus.textContent = getPresenceStatusLabel(status);
      }
    }
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

  window.appSocket.on('conversation:nickname_updated', (payload) => {
    applyConversationNicknameUpdate(payload);
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
      if (typeof loadConversations === 'function') {
        await loadConversations();
      }

      const messages = await fetchConversationMessages(conversationId);
      if (typeof window.renderConversationMessages === 'function') {
        window.renderConversationMessages(messages);
      }

      syncConversationLastMessageSeenStateFromMessages(conversationId, messages);
      markMessagesAsRead(conversationId, messages);
    } catch (_) {
      // Ignore transient fetch errors during app focus transitions.
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshConversationsPeriodically(true);
      syncReadsIfVisible();
    }
  });

  window.addEventListener('focus', () => {
    refreshConversationsPeriodically(true);
    syncReadsIfVisible();
  });

  window.addEventListener('online', () => {
    refreshConversationsPeriodically(true);
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
