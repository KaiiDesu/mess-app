function getNotificationPreviewText(payload) {
  const contentType = String(payload?.content_type || payload?.contentType || '').toLowerCase();
  const text = String(payload?.content || '').trim();

  if (contentType === 'image') return 'Sent a photo';
  if (contentType === 'video') return 'Sent a video';
  if (contentType === 'audio') return 'Sent a voice message';
  if (!text) return 'New message';

  return text.length > 70 ? `${text.slice(0, 70)}...` : text;
}

function getCapacitorLocalNotifications() {
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

function isNativeCapacitorRuntime() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) {
    return false;
  }
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

function ensureToastElement() {
  let toast = document.getElementById('toast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.className = 'toast';
  toast.id = 'toast';
  toast.innerHTML = '<div class="toast-av"></div><div class="toast-info"><div class="toast-name"></div><div class="toast-msg"></div></div>';
  document.body.appendChild(toast);
  return toast;
}

function showInAppNotificationToast(options) {
  const toast = ensureToastElement();
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
  const localNotifications = getCapacitorLocalNotifications();
  if (isNativeCapacitorRuntime() && localNotifications) {
    try {
      const result = await localNotifications.requestPermissions();
      const status = result?.display || result?.receive || 'denied';
      return status === 'granted' ? 'granted' : 'denied';
    } catch (_) {
      return 'denied';
    }
  }

  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    return await Notification.requestPermission();
  } catch (_) {
    return 'denied';
  }
}

async function setupNativeNotificationChannel() {
  const localNotifications = getCapacitorLocalNotifications();
  if (!isNativeCapacitorRuntime() || !localNotifications) return;
  if (window.__zapNativeNotificationChannelReady) return;

  try {
    await localNotifications.createChannel({
      id: 'zap-messages',
      name: 'Messages',
      description: 'Incoming chat messages',
      importance: 5,
      visibility: 1,
      sound: 'default'
    });
  } catch (_) {
    // Some Android versions/devices may already have the channel.
  }

  window.__zapNativeNotificationChannelReady = true;
}

function installNotificationPermissionNudge() {
  if (window.__zapNotificationNudgeInstalled) return;
  window.__zapNotificationNudgeInstalled = true;

  const requestFromGesture = () => {
    if (typeof window.ensureSystemNotificationPermissionWithFeedback === 'function') {
      window.ensureSystemNotificationPermissionWithFeedback();
    } else if (typeof ensureSystemNotificationPermission === 'function') {
      ensureSystemNotificationPermission();
    }

    document.removeEventListener('pointerdown', requestFromGesture, true);
    document.removeEventListener('touchstart', requestFromGesture, true);
    document.removeEventListener('keydown', requestFromGesture, true);
  };

  document.addEventListener('pointerdown', requestFromGesture, true);
  document.addEventListener('touchstart', requestFromGesture, true);
  document.addEventListener('keydown', requestFromGesture, true);
}

function showSystemNotification(options) {
  const localNotifications = getCapacitorLocalNotifications();
  if (isNativeCapacitorRuntime() && localNotifications) {
    const conversationId = options?.conversationId;
    const title = options?.senderName || 'New message';
    const body = options?.messageText || 'You have a new message';
    const notificationId = Number(Date.now() % 2147483000);

    localNotifications
      .schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            schedule: { at: new Date(Date.now() + 80) },
            channelId: 'zap-messages',
            extra: {
              conversationId
            }
          }
        ]
      })
      .catch(() => {
        // Ignore native schedule errors.
      });
    return;
  }

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

function attachNativeNotificationListeners() {
  const localNotifications = getCapacitorLocalNotifications();
  if (!isNativeCapacitorRuntime() || !localNotifications) return;
  if (window.__zapNativeNotificationListenersAttached) return;

  localNotifications.addListener('localNotificationActionPerformed', (event) => {
    const conversationId =
      event?.notification?.extra?.conversationId ||
      event?.actionId?.conversationId ||
      null;

    if (conversationId && typeof openConversationById === 'function') {
      openConversationById(conversationId);
    }
  });

  window.__zapNativeNotificationListenersAttached = true;
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
window.installNotificationPermissionNudge = installNotificationPermissionNudge;

document.addEventListener('DOMContentLoaded', () => {
  setupNativeNotificationChannel();
  attachNativeNotificationListeners();
  installNotificationPermissionNudge();
  // Smoke-test the in-app notification surface once after boot.
  setTimeout(() => {
    showInAppNotificationToast({ senderName: 'Zap', messageText: 'Notifications ready' });
  }, 500);
});

window.ensureSystemNotificationPermissionWithFeedback = async () => {
  const result = await ensureSystemNotificationPermission();
  if (result === 'granted') {
    showInAppNotificationToast({
      senderName: 'Zap',
      messageText: 'System notifications are enabled.'
    });

    showSystemNotification({
      senderName: 'Zap',
      messageText: 'Notification test successful.',
      conversationId: null
    });
  }
  if (result === 'unsupported') {
    showInAppNotificationToast({
      senderName: 'Zap',
      messageText: 'System notification prompt is not supported in this app build.'
    });
  }
  if (result === 'denied') {
    showInAppNotificationToast({
      senderName: 'Zap',
      messageText: 'Notification permission denied. You can enable it in app settings.'
    });
  }
  return result;
};