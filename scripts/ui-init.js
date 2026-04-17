function showToast() {
  if (typeof window.showInAppNotificationToast === 'function') {
    window.showInAppNotificationToast({
      senderName: 'Zap',
      messageText: 'Notifications are enabled.'
    });
  }
}

let pressTimer;
let lastMessagesScrollTop = 0;
let isUserScrollingMessages = false;
let userScrollIntentResetTimer = null;

function markUserScrollIntent() {
  isUserScrollingMessages = true;
  if (userScrollIntentResetTimer) {
    clearTimeout(userScrollIntentResetTimer);
  }
  userScrollIntentResetTimer = setTimeout(() => {
    isUserScrollingMessages = false;
  }, 180);
}

function clearUserScrollIntent() {
  isUserScrollingMessages = false;
  if (userScrollIntentResetTimer) {
    clearTimeout(userScrollIntentResetTimer);
    userScrollIntentResetTimer = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const messagesContainer = document.getElementById('messages-container');
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');

  const beginReactionPickerPress = (event) => {
    const bubble = event.target.closest('.bubble');
    const row = bubble?.closest('.msg-row[data-message-id]');
    if (!row) return;

    pressTimer = setTimeout(() => {
      if (typeof window.showReactionPickerForMessageRow === 'function') {
        window.showReactionPickerForMessageRow(row);
      }
    }, 500);
  };

  messagesContainer.addEventListener('touchstart', e => {
    markUserScrollIntent();
    beginReactionPickerPress(e);
  });
  messagesContainer.addEventListener('touchmove', () => markUserScrollIntent(), { passive: true });
  messagesContainer.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    clearUserScrollIntent();
  });

  messagesContainer.addEventListener('mousedown', e => {
    markUserScrollIntent();
    beginReactionPickerPress(e);
  });
  messagesContainer.addEventListener('mousemove', () => markUserScrollIntent());
  messagesContainer.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.bubble, .reaction-picker, .reaction, .reaction-emoji')) {
      event.preventDefault();
    }
  });
  messagesContainer.addEventListener('wheel', () => markUserScrollIntent(), { passive: true });

  if (sendBtn && msgInput) {
    // Prevent pointer down on send button from blurring the textarea on mobile.
    sendBtn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      msgInput.focus();
    });
  }

  if (messagesContainer && msgInput) {
    lastMessagesScrollTop = messagesContainer.scrollTop;
    messagesContainer.addEventListener('scroll', () => {
      const currentTop = messagesContainer.scrollTop;
      const scrolledUp = currentTop < lastMessagesScrollTop - 12;

      // Only dismiss keyboard for user-driven upward scroll gestures.
      if (scrolledUp && isUserScrollingMessages && document.activeElement === msgInput) {
        msgInput.blur();
      }

      lastMessagesScrollTop = currentTop;
    });
  }

  buildWaveform('waveform-demo', 28);

  if (typeof initSocket === 'function') {
    initSocket();
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  if (typeof loadConversations === 'function') {
    loadConversations();
  }

  if (typeof loadPendingFriendRequests === 'function') {
    loadPendingFriendRequests();
  }

  if (typeof loadAcceptedFriends === 'function') {
    loadAcceptedFriends();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.reaction-picker') && !e.target.closest('.bubble')) {
    if (typeof window.hideReactionPicker === 'function') {
      window.hideReactionPicker();
    } else {
      document.getElementById('reaction-picker').classList.remove('show');
    }
  }

  if (currentView === 'view-chat') {
    const msgInput = document.getElementById('msg-input');
    const clickedInsideInputBar = Boolean(e.target.closest('#input-bar'));

    if (msgInput && !clickedInsideInputBar && document.activeElement === msgInput) {
      msgInput.blur();
    }
  }
});
