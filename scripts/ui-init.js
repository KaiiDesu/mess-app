function showToast() {
  if (typeof window.showInAppNotificationToast === 'function') {
    window.showInAppNotificationToast({
      senderName: 'Zap',
      messageText: 'Notifications are enabled.'
    });
  }
}

function addReaction(emoji) {
  const picker = document.getElementById('reaction-picker');
  picker.classList.remove('show');
  const lastMsg = document.querySelector('#messages-container .msg-row:last-child');
  if (lastMsg) {
    let reactions = lastMsg.querySelector('.reactions-row');
    if (!reactions) {
      reactions = document.createElement('div');
      reactions.className = 'reactions-row';
      lastMsg.querySelector('.bubble')?.after(reactions);
    }
    const r = document.createElement('div');
    r.className = 'reaction';
    r.innerHTML = `${emoji} <span>1</span>`;
    reactions.appendChild(r);
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

  messagesContainer.addEventListener('touchstart', e => {
    markUserScrollIntent();
    if (e.target.closest('.bubble')) {
      pressTimer = setTimeout(() => document.getElementById('reaction-picker').classList.add('show'), 500);
    }
  });
  messagesContainer.addEventListener('touchmove', () => markUserScrollIntent(), { passive: true });
  messagesContainer.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    clearUserScrollIntent();
  });

  messagesContainer.addEventListener('mousedown', e => {
    markUserScrollIntent();
    if (e.target.closest('.bubble')) {
      pressTimer = setTimeout(() => document.getElementById('reaction-picker').classList.add('show'), 500);
    }
  });
  messagesContainer.addEventListener('mousemove', () => markUserScrollIntent());
  messagesContainer.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
    clearUserScrollIntent();
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
    document.getElementById('reaction-picker').classList.remove('show');
  }

  if (currentView === 'view-chat') {
    const msgInput = document.getElementById('msg-input');
    const clickedInsideInputBar = Boolean(e.target.closest('#input-bar'));

    if (msgInput && !clickedInsideInputBar && document.activeElement === msgInput) {
      msgInput.blur();
    }
  }
});
