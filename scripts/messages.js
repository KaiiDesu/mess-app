window.pendingClientMessageIds = window.pendingClientMessageIds || new Set();
window.typingStopTimeout = window.typingStopTimeout || null;
window.remoteTypingHideTimeout = window.remoteTypingHideTimeout || null;
window.selectedMessageRow = window.selectedMessageRow || null;

let lastTypingEmitAt = 0;
let hasActiveTypingSignal = false;

function emitTypingStart() {
  const canEmit = window.appSocket && window.appSocket.connected && window.activeConversationId;
  if (!canEmit) return;

  const now = Date.now();
  if (now - lastTypingEmitAt < 1200) return;

  lastTypingEmitAt = now;
  hasActiveTypingSignal = true;
  emitSocketEvent('message:typing', { conversationId: window.activeConversationId });
}

function emitTypingStop() {
  const canEmit = window.appSocket && window.appSocket.connected && window.activeConversationId;
  if (!canEmit || !hasActiveTypingSignal) return;

  hasActiveTypingSignal = false;
  emitSocketEvent('message:typing_stop', { conversationId: window.activeConversationId });
}

function getCurrentUserId() {
  try {
    const user =
      (typeof window.getStoredSessionUser === 'function' && window.getStoredSessionUser()) ||
      JSON.parse(localStorage.getItem('zap_user') || sessionStorage.getItem('zap_user') || '{}');
    return user.id || null;
  } catch (_) {
    return null;
  }
}

function formatMessageTime(value) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.getHours() + ':' + String(safe.getMinutes()).padStart(2, '0');
}

function formatDeliveredOverlayTime(value) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;

  let hours = safe.getHours();
  const minutes = String(safe.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours || 12;

  return `${hours}:${minutes} ${ampm}`;
}

function scrollMessagesToBottom(force = false) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  if (force) {
    container.scrollTop = container.scrollHeight;
    return;
  }

  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (distanceFromBottom < 80) {
    container.scrollTop = container.scrollHeight;
  }
}

function keepConversationPinnedToBottomDuringMediaLoad(container) {
  if (!container) return;

  const followUntil = Date.now() + 1800;
  const followBottom = () => {
    if (Date.now() <= followUntil) {
      scrollMessagesToBottom(true);
    }
  };

  // Media dimensions become known asynchronously and can push the viewport up.
  const images = container.querySelectorAll('.media-bubble img');
  images.forEach((img) => {
    if (img.complete) return;
    img.addEventListener('load', followBottom, { once: true });
  });

  const videos = container.querySelectorAll('.media-bubble video');
  videos.forEach((video) => {
    if (video.readyState >= 1) return;
    video.addEventListener('loadedmetadata', followBottom, { once: true });
  });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      followBottom();
    });
  });
}

function getActiveOtherUserId() {
  const activeId = window.activeConversationId;
  if (!activeId) return null;
  const conversation = (window.conversations || []).find((item) => item.id === activeId);
  return conversation?.otherUser?.id || null;
}

function getApiBaseUrlForMessages() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getAuthTokenForMessages() {
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

async function fetchMediaUrlById(mediaId) {
  if (!mediaId) return '';

  const token = getAuthTokenForMessages();
  if (!token) return '';

  try {
    const response = await fetch(`${getApiBaseUrlForMessages()}/api/media/${mediaId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return '';

    const payload = await response.json();
    return payload?.storage_url || '';
  } catch (_) {
    return '';
  }
}

function resolveInitialDeliveryStatus(message, isMe, currentUserId) {
  if (!isMe) return null;

  if (message?.clientMessageId || message?.client_message_id) {
    return 'Sent';
  }

  const readBy = Array.isArray(message?.readBy) ? message.readBy : [];
  const seenByOther = readBy.some((id) => id && id !== currentUserId);
  return seenByOther ? 'Seen' : 'Delivered';
}

function setVideoPendingIndicator(row, isPending) {
  if (!row) return;

  const videoBubble = row.querySelector('.media-bubble[data-media-type="video"]');
  if (!videoBubble) return;

  row.dataset.videoPending = isPending ? '1' : '0';
  videoBubble.classList.toggle('is-pending', Boolean(isPending));
}

function setMessageRowDeliveryStatus(row, status) {
  if (!row || !status) return;
  const statusNode = row.querySelector('.msg-delivery-status');
  if (!statusNode) return;
  row.dataset.deliveryStatus = status;

  if (row.dataset.videoPending === '1' && status !== 'Sending' && status !== 'Sent') {
    setVideoPendingIndicator(row, false);
  }

  statusNode.textContent = status;
  recomputeOutgoingStatusVisibility();
}

function clearSelectedMessageState() {
  if (window.selectedMessageRow) {
    window.selectedMessageRow.classList.remove('message-dimmed');
    window.selectedMessageRow = null;
  }

  const overlay = document.getElementById('message-delivered-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function showDeliveredOverlayForBubble(bubble, row) {
  const container = document.getElementById('messages-container');
  if (!container || !bubble || !row) return;

  clearSelectedMessageState();
  row.classList.add('message-dimmed');
  window.selectedMessageRow = row;

  const deliveredAt = row.dataset.deliveredAt || new Date().toISOString();
  const label = `Delivered ${formatDeliveredOverlayTime(deliveredAt)}`;

  const overlay = document.createElement('div');
  overlay.id = 'message-delivered-overlay';
  overlay.className = 'message-delivered-overlay';
  overlay.textContent = label;

  // Position overlay centered horizontally relative to message list and above the clicked bubble.
  const top = Math.max(0, bubble.offsetTop - 24);
  overlay.style.top = `${top}px`;

  container.appendChild(overlay);
}

function recomputeOutgoingStatusVisibility() {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const ownRows = [...container.querySelectorAll('.msg-row.me')];

  ownRows.forEach((row) => {
    const statusNode = row.querySelector('.msg-delivery-status');
    if (!statusNode) return;

    if (row.dataset.videoPending === '1') {
      statusNode.style.display = 'none';
      return;
    }

    const currentStatus = row.dataset.deliveryStatus || statusNode.textContent || '';
    if (!currentStatus) {
      statusNode.style.display = 'none';
      return;
    }

    let nextRow = row.nextElementSibling;
    while (nextRow && !nextRow.classList.contains('msg-row')) {
      nextRow = nextRow.nextElementSibling;
    }

    // Messenger-style: only the newest bubble in a connected own-message stack shows status.
    const shouldShow = !nextRow || !nextRow.classList.contains('me');

    statusNode.style.display = shouldShow ? 'inline' : 'none';
  });
}

function updateMessageDeliveryStatusByClientId(clientMessageId, status, messageId, deliveredAt) {
  if (!clientMessageId) return;

  const row = document.querySelector(`.msg-row.me[data-client-message-id="${clientMessageId}"]`);
  if (!row) {
    if ((status === 'Delivered' || status === 'Seen') && typeof window.removePendingMediaEntry === 'function') {
      window.removePendingMediaEntry(clientMessageId);
    }
    if ((status === 'Delivered' || status === 'Seen') && typeof window.clearPendingMediaPreviewUrl === 'function') {
      window.clearPendingMediaPreviewUrl(clientMessageId);
    }
    return;
  }

  if (messageId) {
    row.dataset.messageId = messageId;
  }
  if (deliveredAt) {
    row.dataset.deliveredAt = deliveredAt;
  }

  setMessageRowDeliveryStatus(row, status);

  if ((status === 'Delivered' || status === 'Seen') && typeof window.removePendingMediaEntry === 'function') {
    window.removePendingMediaEntry(clientMessageId);
  }
  if ((status === 'Delivered' || status === 'Seen') && typeof window.clearPendingMediaPreviewUrl === 'function') {
    window.clearPendingMediaPreviewUrl(clientMessageId);
  }
}

function updateMessageDeliveryStatusByMessageId(messageId, status) {
  if (!messageId) return;

  const row = document.querySelector(`.msg-row.me[data-message-id="${messageId}"]`);
  if (!row) return;

  setMessageRowDeliveryStatus(row, status);
}

function updateMessageMediaByClientId(clientMessageId, mediaUrl, contentType) {
  if (!clientMessageId || !mediaUrl) return;

  const row = document.querySelector(`.msg-row.me[data-client-message-id="${clientMessageId}"]`);
  if (!row) return;

  const normalizedType = String(contentType || '').toLowerCase();
  if (normalizedType && normalizedType !== 'image' && normalizedType !== 'video') {
    return;
  }

  const mediaBubble = row.querySelector('.media-bubble');
  if (!mediaBubble) return;

  mediaBubble.setAttribute('data-media-url', mediaUrl);
  const mediaNode = normalizedType === 'video' ? mediaBubble.querySelector('video') : mediaBubble.querySelector('img');
  if (mediaNode) {
    mediaNode.src = mediaUrl;
  }

  if (row.dataset.objectUrl) {
    URL.revokeObjectURL(row.dataset.objectUrl);
    delete row.dataset.objectUrl;
  }
}

function renderPersistedPendingMediaMessages(conversationId) {
  if (!conversationId || typeof window.getPendingMediaForConversation !== 'function') {
    return;
  }

  const pendingItems = window.getPendingMediaForConversation(conversationId);
  if (!Array.isArray(pendingItems) || !pendingItems.length) {
    return;
  }

  pendingItems.forEach((item) => {
    if (!item?.clientMessageId || item.contentType !== 'video') {
      return;
    }

    const existing = document.querySelector(`.msg-row.me[data-client-message-id="${item.clientMessageId}"]`);
    if (existing) {
      return;
    }

    const restoredPreviewUrl =
      typeof window.getPendingMediaPreviewUrl === 'function'
        ? window.getPendingMediaPreviewUrl(item.clientMessageId)
        : '';

    addMessage('', true, false, item.clientMessageId, {
      contentType: 'video',
      fileName: item.fileName,
      mediaUrl: restoredPreviewUrl,
      deliveryStatus: 'Sent',
      createdAt: item.createdAt || new Date().toISOString(),
      showVideoLoading: true,
      objectUrl: restoredPreviewUrl && restoredPreviewUrl.startsWith('blob:') ? restoredPreviewUrl : undefined
    });
  });
}

function onInputChange(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  const hasText = el.value.trim().length > 0;
  document.getElementById('send-btn').style.display = hasText ? 'flex' : 'none';
  document.getElementById('voice-btn').style.display = hasText ? 'none' : 'flex';

  if (!window.activeConversationId) return;

  if (hasText) {
    emitTypingStart();

    if (window.typingStopTimeout) {
      clearTimeout(window.typingStopTimeout);
    }

    window.typingStopTimeout = setTimeout(() => {
      emitTypingStop();
    }, 1400);
  } else {
    if (window.typingStopTimeout) {
      clearTimeout(window.typingStopTimeout);
      window.typingStopTimeout = null;
    }
    emitTypingStop();
  }
}

function sendMessage() {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const hasSocket = window.appSocket && window.appSocket.connected;
  const conversationId = window.activeConversationId;
  const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (hasSocket && conversationId) {
    window.pendingClientMessageIds.add(clientMessageId);

    // Optimistically render immediately on sender side.
    addMessage(text, true, false, clientMessageId);

    emitSocketEvent('message:send', {
      conversationId,
      content: text,
      contentType: 'text',
      clientMessageId
    });
  } else {
    // Fallback for local-only preview when no active realtime conversation is set.
    addMessage(text, true);
    if (!conversationId) {
      console.warn('[chat] No activeConversationId. Call joinConversation(conversationId) first.');
    }
  }

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').style.display = 'none';
  document.getElementById('voice-btn').style.display = 'flex';

  if (window.typingStopTimeout) {
    clearTimeout(window.typingStopTimeout);
    window.typingStopTimeout = null;
  }
  emitTypingStop();

  // Keep keyboard open after send while user remains in chat.
  if (currentView === 'view-chat' && window.activeConversationId) {
    requestAnimationFrame(() => {
      input.focus();
    });
  }
}

function addMessage(text, isMe, isVoice, clientMessageId, meta = {}) {
  const container = document.getElementById('messages-container');
  const emptyState = document.getElementById('chat-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' me' : '');
  if (clientMessageId) {
    row.dataset.clientMessageId = clientMessageId;
  }
  if (meta.messageId) {
    row.dataset.messageId = meta.messageId;
  }
  if (meta.objectUrl) {
    row.dataset.objectUrl = meta.objectUrl;
  }
  const deliveredAt = meta.createdAt || new Date().toISOString();
  row.dataset.deliveredAt = deliveredAt;
  const deliveryStatus = isMe ? (meta.deliveryStatus || (clientMessageId ? 'Sent' : 'Delivered')) : null;
  const contentType = meta.contentType || (isVoice ? 'audio' : 'text');
  const mediaUrl = meta.mediaUrl || text;
  const showVideoLoading = Boolean(meta.showVideoLoading && isMe && contentType === 'video');

  if (isMe && deliveryStatus) {
    row.dataset.deliveryStatus = deliveryStatus;
  }
  if (showVideoLoading) {
    row.dataset.videoPending = '1';
  }

  if (!isMe) {
    if (contentType === 'image') {
      row.innerHTML = `<div class="msg-avatar">😄</div><div><div class="bubble them media-bubble" style="padding:0" data-open-media="1" data-media-type="image" data-media-url="${mediaUrl}"><img src="${mediaUrl}" alt="image"><div class="media-overlay"></div></div></div>`;
    } else if (contentType === 'video') {
      row.innerHTML = `<div class="msg-avatar">😄</div><div><div class="bubble them media-bubble" style="padding:0" data-media-type="video" data-media-url="${mediaUrl}"><video src="${mediaUrl}" preload="metadata"></video><div class="media-overlay"></div><button class="play-btn video-inline-play" type="button" aria-label="Play video"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#fff"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg></button></div></div>`;
    } else {
      row.innerHTML = `<div class="msg-avatar">😄</div><div><div class="bubble them">${text}</div></div>`;
    }
  } else if (isVoice) {
    const dur = recordingSeconds || 3;
    row.innerHTML = `<div><div class="bubble me voice-bubble"><button class="voice-play" onclick="playVoice(this)"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></button><div class="voice-waveform" id="vw-${Date.now()}"></div><div class="voice-time">0:${String(dur).padStart(2, '0')}</div></div><div class="msg-time"><span class="msg-delivery-status">${deliveryStatus}</span></div></div>`;
  } else {
    if (contentType === 'image') {
      row.innerHTML = `<div><div class="bubble me media-bubble" style="padding:0" data-open-media="1" data-media-type="image" data-media-url="${mediaUrl}"><img src="${mediaUrl}" alt="image"><div class="media-overlay"></div></div><div class="msg-time"><span class="msg-delivery-status">${deliveryStatus}</span></div></div>`;
    } else if (contentType === 'video') {
      const pendingOverlay = showVideoLoading
        ? '<div class="video-send-loading"><div class="video-send-spinner"></div></div>'
        : '';
      const hasMediaUrl = Boolean(mediaUrl);
      const videoSurface = hasMediaUrl
        ? `<video src="${mediaUrl}" preload="metadata"></video><button class="play-btn video-inline-play" type="button" aria-label="Play video"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#fff"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg></button>`
        : '<div class="video-pending-surface"><svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:rgba(255,255,255,0.86);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polygon points="8 5 19 12 8 19 8 5"></polygon></svg><span>Sending video...</span></div>';
      row.innerHTML = `<div><div class="bubble me media-bubble${showVideoLoading ? ' is-pending' : ''}" style="padding:0" data-media-type="video" data-media-url="${mediaUrl}">${videoSurface}<div class="media-overlay"></div>${pendingOverlay}</div><div class="msg-time"><span class="msg-delivery-status">${deliveryStatus}</span></div></div>`;
    } else {
      row.innerHTML = `<div><div class="bubble me">${text}</div><div class="msg-time"><span class="msg-delivery-status">${deliveryStatus}</span></div></div>`;
    }
  }

  container.appendChild(row);
  if (isVoice) {
    const wvId = row.querySelector('.voice-waveform')?.id;
    if (wvId) buildWaveform(wvId, 24);
  }
  container.scrollTop = container.scrollHeight;

  if (isMe) {
    recomputeOutgoingStatusVisibility();
  }
}

function clearRenderedMessages() {
  const container = document.getElementById('messages-container');
  if (!container) return;

  container.querySelectorAll('.msg-row, .msg-date, #chat-empty-state').forEach((node) => node.remove());
}

function renderConversationMessages(messages) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  clearRenderedMessages();

  const activeConversationId = window.activeConversationId;

  if (!messages || !messages.length) {
    renderPersistedPendingMediaMessages(activeConversationId);

    const hasPendingRows = Boolean(container.querySelector('.msg-row'));
    if (!hasPendingRows) {
      const empty = document.createElement('div');
      empty.id = 'chat-empty-state';
      empty.style.padding = '18px 12px';
      empty.style.fontSize = '12px';
      empty.style.color = 'var(--text3)';
      empty.style.textAlign = 'center';
      empty.textContent = 'No messages yet. Say hi!';
      container.appendChild(empty);
    }
    scrollMessagesToBottom(true);
    return;
  }

  const dateBadge = document.createElement('div');
  dateBadge.className = 'msg-date';
  dateBadge.textContent = 'Conversation';
  container.appendChild(dateBadge);

  const currentUserId = getCurrentUserId();
  const otherUserId = getActiveOtherUserId();
  const ordered = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  ordered.forEach((message) => {
    const senderId = message.sender_id || message.sender?.id;
    const isMe = Boolean(currentUserId && senderId === currentUserId);
    const readBy = Array.isArray(message.readBy) ? message.readBy : [];
    const seenByOther = Boolean(otherUserId && readBy.includes(otherUserId));
    const initialDeliveryStatus = resolveInitialDeliveryStatus(message, isMe, currentUserId);

    addMessage(
      message.content || '',
      isMe,
      message.content_type === 'audio',
      message.clientMessageId || message.client_message_id,
      {
        messageId: message.id,
        createdAt: message.created_at,
        contentType: message.content_type,
        mediaUrl: message.mediaUrl || message.content,
        fileName: message.file_name,
        deliveryStatus: isMe ? (seenByOther ? 'Seen' : initialDeliveryStatus || 'Delivered') : null
      }
    );
  });

  renderPersistedPendingMediaMessages(activeConversationId);

  recomputeOutgoingStatusVisibility();
  scrollMessagesToBottom(true);
  keepConversationPinnedToBottomDuringMediaLoad(container);
}

const replies = [
  "That's so true! 😄",
  'No way! 🤯',
  'Haha I was just thinking about that!',
  'Send me more updates 👀',
  "Okay okay I'm convinced 😂",
  'Actually that\'s pretty fire ngl 🔥',
  'Wait really?? Tell me more',
  'Same honestly 💀',
  "Lol I can't with you 😭",
  'Omg yes finally someone gets it 🙌'
];

function simulateReply(trigger) {
  const container = document.getElementById('messages-container');
  const typingRow = document.createElement('div');
  typingRow.className = 'msg-row';
  typingRow.innerHTML = '<div class="msg-avatar">😄</div><div class="bubble them" style="padding:0"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
  container.appendChild(typingRow);
  container.scrollTop = container.scrollHeight;

  setTimeout(() => {
    container.removeChild(typingRow);
    const reply = replies[Math.floor(Math.random() * replies.length)];
    addMessage(reply, false);
  }, 1500);
}

async function handleIncomingSocketMessage(payload) {
  if (!payload) return;

  const currentUserId = getCurrentUserId();
  const messageConversationId = payload.conversation_id || payload.conversationId;

  if (window.activeConversationId && messageConversationId && window.activeConversationId !== messageConversationId) {
    return;
  }

  if (payload.clientMessageId && window.pendingClientMessageIds.has(payload.clientMessageId)) {
    // Sender ack for an already optimistic-rendered local message.
    window.pendingClientMessageIds.delete(payload.clientMessageId);

    updateMessageMediaByClientId(
      payload.clientMessageId,
      payload.mediaUrl || payload.content,
      payload.content_type
    );

    updateMessageDeliveryStatusByClientId(
      payload.clientMessageId,
      'Delivered',
      payload.id,
      payload.created_at || new Date().toISOString()
    );
    return;
  }

  const senderId = payload.sender_id || payload.sender?.id;
  const isMe = Boolean(currentUserId && senderId === currentUserId);

  if (isMe && payload.clientMessageId && typeof window.removePendingMediaEntry === 'function') {
    window.removePendingMediaEntry(payload.clientMessageId);
  }
  if (isMe && payload.clientMessageId && typeof window.clearPendingMediaPreviewUrl === 'function') {
    window.clearPendingMediaPreviewUrl(payload.clientMessageId);
  }

  if (isMe && payload.id) {
    const existingOwnRow = document.querySelector(`.msg-row.me[data-message-id="${payload.id}"]`);
    if (existingOwnRow) {
      return;
    }
  }

  let resolvedMediaUrl = payload.mediaUrl || payload.content || '';
  if (!resolvedMediaUrl && (payload.content_type === 'image' || payload.content_type === 'video') && payload.mediaId) {
    resolvedMediaUrl = await fetchMediaUrlById(payload.mediaId);
  }

  addMessage(payload.content || '', isMe, payload.content_type === 'audio', payload.clientMessageId, {
    messageId: payload.id,
    createdAt: payload.created_at,
    contentType: payload.content_type,
    mediaUrl: resolvedMediaUrl,
    fileName: payload.fileName,
    deliveryStatus: isMe ? 'Delivered' : null
  });
}

function handleMessageReadReceipt(payload) {
  const messageIds = Array.isArray(payload?.messageIds) ? payload.messageIds : [];
  messageIds.forEach((messageId) => {
    updateMessageDeliveryStatusByMessageId(messageId, 'Seen');
  });

  recomputeOutgoingStatusVisibility();
}

function resetChatForRealtimeTest() {
  const container = document.getElementById('messages-container');
  if (!container) return;
  container.querySelectorAll('.msg-row').forEach((row) => row.remove());
}

function showRemoteTypingIndicator(payload) {
  const conversationId = payload?.conversationId || payload?.conversation_id;
  if (!window.activeConversationId || !conversationId || conversationId !== window.activeConversationId) {
    return;
  }

  const container = document.getElementById('messages-container');
  if (!container) return;

  let row = document.getElementById('remote-typing-row');
  if (!row) {
    row = document.createElement('div');
    row.id = 'remote-typing-row';
    row.className = 'msg-row';
    row.innerHTML = '<div class="msg-avatar">😄</div><div class="bubble them" style="padding:0"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>';
    container.appendChild(row);
  }

  container.scrollTop = container.scrollHeight;

  if (window.remoteTypingHideTimeout) {
    clearTimeout(window.remoteTypingHideTimeout);
  }
  window.remoteTypingHideTimeout = setTimeout(() => {
    hideRemoteTypingIndicator(payload);
  }, 3000);
}

function hideRemoteTypingIndicator(payload) {
  const conversationId = payload?.conversationId || payload?.conversation_id;
  if (conversationId && window.activeConversationId && conversationId !== window.activeConversationId) {
    return;
  }

  const row = document.getElementById('remote-typing-row');
  if (row) {
    row.remove();
  }

  if (window.remoteTypingHideTimeout) {
    clearTimeout(window.remoteTypingHideTimeout);
    window.remoteTypingHideTimeout = null;
  }
}

document.addEventListener('click', (event) => {
  const bubble = event.target.closest('.bubble');
  const container = document.getElementById('messages-container');

  if (!container) return;

  if (!bubble || !container.contains(bubble)) {
    clearSelectedMessageState();
    return;
  }

  const row = bubble.closest('.msg-row');
  if (!row) return;

  // Video bubbles use tap/click for playback and fullscreen interactions.
  if (bubble.matches('.media-bubble[data-media-type="video"]')) {
    clearSelectedMessageState();
    return;
  }

  showDeliveredOverlayForBubble(bubble, row);
});

window.handleIncomingSocketMessage = handleIncomingSocketMessage;
window.handleMessageReadReceipt = handleMessageReadReceipt;
window.resetChatForRealtimeTest = resetChatForRealtimeTest;
window.showRemoteTypingIndicator = showRemoteTypingIndicator;
window.hideRemoteTypingIndicator = hideRemoteTypingIndicator;
window.renderConversationMessages = renderConversationMessages;
window.addMessage = addMessage;
