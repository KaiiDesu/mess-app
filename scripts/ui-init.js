function showToast() {
  // Intentionally no-op: removed notification test toast trigger.
}

let pressTimer;
let lastMessagesScrollTop = 0;
let isUserScrollingMessages = false;
let userScrollIntentResetTimer = null;
let pressStartPoint = null;
let activePressRow = null;

const MESSAGE_REPLY_SWIPE_TRIGGER_PX = 72;
const MESSAGE_REPLY_SWIPE_MAX_PX = 86;
let replySwipeState = {
  row: null,
  contentNode: null,
  startX: 0,
  startY: 0,
  maxDx: 0,
  direction: 1,
  active: false
};

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

  const getMessageContentNode = (row) => {
    if (!row) return null;
    return [...row.children].find((child) => !child.classList.contains('msg-avatar')) || null;
  };

  const beginReplySwipe = (event) => {
    if (event.target.closest('.message-link, .message-link-preview, .reply-ghost, .reactions-row, .reaction')) {
      return;
    }

    const bubble = event.target.closest('.bubble');
    const row = bubble?.closest('.msg-row[data-message-id]');
    if (!row) return;

    const point = event.touches?.[0] || event;
    const contentNode = getMessageContentNode(row);
    if (!contentNode) return;

    replySwipeState = {
      row,
      contentNode,
      startX: Number(point?.clientX || 0),
      startY: Number(point?.clientY || 0),
      maxDx: 0,
      direction: row.classList.contains('me') ? -1 : 1,
      active: true
    };
  };

  const updateReplySwipe = (event) => {
    if (!replySwipeState.active || !replySwipeState.row || !replySwipeState.contentNode) return;

    const point = event.touches?.[0] || event;
    const rawDx = Number(point?.clientX || 0) - replySwipeState.startX;
    const direction = replySwipeState.direction || 1;
    const dx = rawDx * direction;
    const dy = Math.abs(Number(point?.clientY || 0) - replySwipeState.startY);

    if (dy > 24 && dx < 18) {
      endReplySwipe(false);
      return;
    }

    if (dx <= 0) {
      replySwipeState.maxDx = Math.max(replySwipeState.maxDx, 0);
      replySwipeState.contentNode.style.transform = 'translateX(0px)';
      return;
    }

    const clamped = Math.min(dx, MESSAGE_REPLY_SWIPE_MAX_PX);
    replySwipeState.maxDx = Math.max(replySwipeState.maxDx, clamped);
    replySwipeState.contentNode.style.transition = 'none';
    replySwipeState.contentNode.style.transform = `translateX(${clamped * direction}px)`;
  };

  const endReplySwipe = (shouldTrigger = true) => {
    if (!replySwipeState.active || !replySwipeState.contentNode) {
      replySwipeState = {
        row: null,
        contentNode: null,
        startX: 0,
        startY: 0,
        maxDx: 0,
        direction: 1,
        active: false
      };
      return;
    }

    const { contentNode, row, maxDx } = replySwipeState;
    contentNode.style.transition = 'transform 0.18s ease';
    contentNode.style.transform = 'translateX(0px)';

    setTimeout(() => {
      if (contentNode) {
        contentNode.style.transition = '';
      }
    }, 220);

    if (shouldTrigger && maxDx >= MESSAGE_REPLY_SWIPE_TRIGGER_PX && typeof window.startReplyToMessageRow === 'function') {
      window.__zapSuppressBubbleClickUntil = Date.now() + 250;
      window.startReplyToMessageRow(row);
    }

    replySwipeState = {
      row: null,
      contentNode: null,
      startX: 0,
      startY: 0,
      maxDx: 0,
      direction: 1,
      active: false
    };
  };

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
    beginReplySwipe(e);
  });
  messagesContainer.addEventListener('touchmove', (e) => {
    maybeCancelPressOnMove(e);
    updateReplySwipe(e);
  }, { passive: true });
  messagesContainer.addEventListener('touchend', () => {
    cancelReactionPickerPress();
    endReplySwipe(true);
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('touchcancel', () => {
    cancelReactionPickerPress();
    endReplySwipe(false);
    clearUserScrollIntent();
  });

  messagesContainer.addEventListener('mousedown', e => {
    markUserScrollIntent();
    beginReactionPickerPress(e);
    beginReplySwipe(e);
  });
  messagesContainer.addEventListener('mousemove', (e) => {
    maybeCancelPressOnMove(e);
    updateReplySwipe(e);
  });
  messagesContainer.addEventListener('mouseup', () => {
    cancelReactionPickerPress();
    endReplySwipe(true);
    clearUserScrollIntent();
  });
  messagesContainer.addEventListener('mouseleave', () => {
    cancelReactionPickerPress();
    endReplySwipe(false);
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
    endReplySwipe(false);
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
