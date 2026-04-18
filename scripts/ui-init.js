function showToast() {
  // Intentionally no-op: removed notification test toast trigger.
}

let pressTimer;
let lastMessagesScrollTop = 0;
let isUserScrollingMessages = false;
let userScrollIntentResetTimer = null;
let pressStartPoint = null;
let activePressRow = null;

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
    if (event.target.closest('.message-link, .message-link-preview')) {
      return;
    }

    const bubble = event.target.closest('.bubble');
    const row = bubble?.closest('.msg-row[data-message-id]');
    if (!row) return;

    activePressRow = row;
    const pointer = event.touches?.[0] || event;
    pressStartPoint = {
      x: Number(pointer?.clientX || 0),
      y: Number(pointer?.clientY || 0)
    };

    pressTimer = setTimeout(() => {
      if (typeof window.showReactionPickerForMessageRow === 'function') {
        window.showReactionPickerForMessageRow(row);
      }

      if (typeof window.showMessageActionSheetForRow === 'function') {
        window.showMessageActionSheetForRow(row);
      }

      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }, 500);
  };

  const cancelReactionPickerPress = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    pressStartPoint = null;
    activePressRow = null;
  };

  const maybeCancelPressOnMove = (event) => {
    markUserScrollIntent();
    if (!pressStartPoint || !activePressRow) return;

    const pointer = event.touches?.[0] || event;
    const currentX = Number(pointer?.clientX || 0);
    const currentY = Number(pointer?.clientY || 0);
    const dx = Math.abs(currentX - pressStartPoint.x);
    const dy = Math.abs(currentY - pressStartPoint.y);

    if (dx > 10 || dy > 10) {
      cancelReactionPickerPress();
    }
  };

  messagesContainer.addEventListener('touchstart', e => {
    markUserScrollIntent();
    beginReactionPickerPress(e);
  });
  messagesContainer.addEventListener('touchmove', (e) => maybeCancelPressOnMove(e), { passive: true });
  messagesContainer.addEventListener('touchend', () => {
    cancelReactionPickerPress();
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('touchcancel', () => {
    cancelReactionPickerPress();
    clearUserScrollIntent();
  });

  messagesContainer.addEventListener('mousedown', e => {
    markUserScrollIntent();
    beginReactionPickerPress(e);
  });
  messagesContainer.addEventListener('mousemove', (e) => maybeCancelPressOnMove(e));
  messagesContainer.addEventListener('mouseup', () => {
    cancelReactionPickerPress();
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('mouseleave', () => {
    cancelReactionPickerPress();
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.bubble, .reaction-picker, .reaction, .reaction-emoji, .message-action-sheet')) {
      event.preventDefault();
    }
  });
  messagesContainer.addEventListener('wheel', () => {
    markUserScrollIntent();
    cancelReactionPickerPress();
  }, { passive: true });

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
  if (!e.target.closest('.reaction-picker') && !e.target.closest('.bubble') && !e.target.closest('.message-action-sheet')) {
    if (typeof window.hideReactionPicker === 'function') {
      window.hideReactionPicker();
    } else {
      document.getElementById('reaction-picker').classList.remove('show');
    }

    if (typeof window.hideMessageActionSheet === 'function') {
      window.hideMessageActionSheet();
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
