function getNotificationPreviewText(payload) {
  const contentType = String(payload?.content_type || payload?.contentType || '').toLowerCase();
  const text = String(payload?.content || '').trim();

  if (contentType === 'image') return 'Sent a photo';
  if (contentType === 'video') return 'Sent a video';
  if (contentType === 'audio') return 'Sent a voice message';
  if (!text) return 'New message';

  return text.length > 70 ? `${text.slice(0, 70)}...` : text;
}

function getNotificationSenderName(payload) {
  const fromPayload =
    payload?.sender?.display_name ||
    payload?.sender?.username ||
    payload?.senderName ||
    payload?.sender_name ||
    '';
  if (fromPayload) return fromPayload;

  const conversationId = payload?.conversation_id || payload?.conversationId;
  const list = Array.isArray(window.conversations) ? window.conversations : [];
  const conversation = list.find((item) => item.id === conversationId);
  const other = conversation?.otherUser || {};
  return other.display_name || other.nickname || other.username || 'New message';
}

function hideInAppNotificationToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.classList.remove('show');
}

function showInAppNotificationToast(options) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const nameEl = toast.querySelector('.toast-name');
  const msgEl = toast.querySelector('.toast-msg');
  const avEl = toast.querySelector('.toast-av');

  const senderName = options?.senderName || 'New message';
  const messageText = options?.messageText || 'You have a new message';

  if (nameEl) nameEl.textContent = senderName;
  if (msgEl) msgEl.textContent = messageText;
  if (avEl) avEl.textContent = senderName.trim().charAt(0).toUpperCase() || '•';

  toast.classList.add('show');

  if (window.__zapToastHideTimer) {
    clearTimeout(window.__zapToastHideTimer);
  }
  window.__zapToastHideTimer = setTimeout(() => {
    hideInAppNotificationToast();
  }, 3200);

  const conversationId = options?.conversationId;
  if (conversationId) {
    toast.onclick = () => {
      hideInAppNotificationToast();
      if (typeof openConversationById === 'function') {
        openConversationById(conversationId);
      }
    };
  }
}

async function ensureSystemNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    return await Notification.requestPermission();
  } catch (_) {
    return 'denied';
  }
}

function showSystemNotification(options) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = options?.senderName || 'New message';
  const body = options?.messageText || 'You have a new message';
  const conversationId = options?.conversationId;

  try {
    const notification = new Notification(title, {
      body,
      tag: conversationId || 'zap-message',
      renotify: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (conversationId && typeof openConversationById === 'function') {
        openConversationById(conversationId);
      }
    };
  } catch (_) {
    // Ignore system notification errors in unsupported webviews.
  }
}

function shouldNotifyForIncomingMessage(payload) {
  const senderId = payload?.sender_id || payload?.sender?.id;
  const currentUserId =
    typeof getCurrentSessionUserId === 'function'
      ? getCurrentSessionUserId()
      : typeof getCurrentUserId === 'function'
      ? getCurrentUserId()
      : null;

  if (!senderId || !currentUserId) return true;
  return senderId !== currentUserId;
}

function notifyIncomingMessage(payload) {
  if (!payload || !shouldNotifyForIncomingMessage(payload)) return;

  const conversationId = payload?.conversation_id || payload?.conversationId;
  const senderName = getNotificationSenderName(payload);
  const messageText = getNotificationPreviewText(payload);

  const inVisibleActiveConversation =
    typeof isConversationCurrentlyVisibleOnScreen === 'function'
      ? isConversationCurrentlyVisibleOnScreen(conversationId)
      : false;

  if (!inVisibleActiveConversation) {
    showInAppNotificationToast({ senderName, messageText, conversationId });
  }

  const appBackgrounded =
    typeof isAppForeground === 'function' ? !isAppForeground() : document.visibilityState !== 'visible';

  if (appBackgrounded) {
    showSystemNotification({ senderName, messageText, conversationId });
  }
}

window.hideInAppNotificationToast = hideInAppNotificationToast;
window.showInAppNotificationToast = showInAppNotificationToast;
window.notifyIncomingMessage = notifyIncomingMessage;
window.ensureSystemNotificationPermission = ensureSystemNotificationPermission;