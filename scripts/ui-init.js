function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
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
document.addEventListener('DOMContentLoaded', () => {
  const messagesContainer = document.getElementById('messages-container');
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.getElementById('send-btn');

  messagesContainer.addEventListener('touchstart', e => {
    if (e.target.closest('.bubble')) {
      pressTimer = setTimeout(() => document.getElementById('reaction-picker').classList.add('show'), 500);
    }
  });
  messagesContainer.addEventListener('touchend', () => clearTimeout(pressTimer));

  messagesContainer.addEventListener('mousedown', e => {
    if (e.target.closest('.bubble')) {
      pressTimer = setTimeout(() => document.getElementById('reaction-picker').classList.add('show'), 500);
    }
  });
  messagesContainer.addEventListener('mouseup', () => clearTimeout(pressTimer));

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

      if (scrolledUp && document.activeElement === msgInput) {
        msgInput.blur();
      }

      lastMessagesScrollTop = currentTop;
    });
  }

  buildWaveform('waveform-demo', 28);
  setTimeout(showToast, 3000);

  if (typeof initSocket === 'function') {
    initSocket();
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  if (typeof loadConversations === 'function') {
    loadConversations();

    setInterval(() => {
      loadConversations();
    }, 5000);
  }

  if (typeof loadPendingFriendRequests === 'function') {
    loadPendingFriendRequests();

    // Keep pending requests fresh while testing multi-browser flow.
    setInterval(() => {
      loadPendingFriendRequests();
    }, 4000);
  }

  if (typeof loadAcceptedFriends === 'function') {
    loadAcceptedFriends();

    // Keep accepted friends list synced while testing multi-browser flow.
    setInterval(() => {
      loadAcceptedFriends();
    }, 5000);
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
