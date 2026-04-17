let friendSearchTimeout = null;
window.pendingFriendRequests = window.pendingFriendRequests || [];
window.acceptedFriends = window.acceptedFriends || [];

function getApiBaseUrlFromWindow() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getAuthToken() {
  return localStorage.getItem('zap_jwt') || '';
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
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '🙂';
}

function renderFriendSearchState(message) {
  const container = document.getElementById('friend-search-results');
  if (!container) return;
  container.innerHTML = `<div style="padding:12px 4px;font-size:12px;color:var(--text3)">${escapeHtml(message)}</div>`;
}

function renderFriendSearchResults(users) {
  const container = document.getElementById('friend-search-results');
  if (!container) return;

  if (!users || users.length === 0) {
    renderFriendSearchState('No users found. Try a different name or email.');
    return;
  }

  container.innerHTML = users
    .map((user) => {
      const displayName = escapeHtml(user.display_name || 'Unknown');
      const username = escapeHtml(user.username || user.email || user.id || 'user');
      const avatar = getInitialAvatar(user.display_name);
      const userId = escapeHtml(user.id);

      return `
        <div class="friend-item" style="padding:10px 0" data-user-id="${userId}">
          <div class="avatar" style="width:44px;height:44px;font-size:18px;background:var(--bg4);border:none">${avatar}</div>
          <div class="friend-info">
            <div class="friend-name">${displayName}</div>
            <div class="friend-username">@${username}</div>
          </div>
          <button class="btn-sm add" data-add-friend-id="${userId}">+ Add</button>
        </div>
      `;
    })
    .join('');
}

function openModal() {
  const modal = document.getElementById('add-friend-modal');
  if (!modal) return;

  modal.classList.add('open');

  const input = document.getElementById('friend-search-input');
  if (input) {
    input.value = '';
  }

  renderFriendSearchState('Search by display name, username, or email.');
}

function closeAddFriendModal() {
  const modal = document.getElementById('add-friend-modal');
  if (!modal) return;

  modal.classList.remove('open');

  const input = document.getElementById('friend-search-input');
  if (input) {
    input.blur();
  }
}

function closeModal(e) {
  if (e.target === document.getElementById('add-friend-modal')) {
    closeAddFriendModal();
  }
}

async function searchFriends(query) {
  const q = String(query || '').trim();

  if (friendSearchTimeout) {
    clearTimeout(friendSearchTimeout);
  }

  if (q.length < 2) {
    renderFriendSearchState('Type at least 2 characters to search.');
    return;
  }

  // Immediate UX feedback so users know the search is running.
  renderFriendSearchState('Searching...');

  friendSearchTimeout = setTimeout(async () => {
    const token = getAuthToken();
    if (!token) {
      renderFriendSearchState('Please sign in first.');
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrlFromWindow()}/api/users/search?q=${encodeURIComponent(q)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await response.json();
      if (!response.ok) {
        renderFriendSearchState(payload?.message || 'Search failed.');
        return;
      }

      renderFriendSearchResults(payload.results || []);
    } catch (error) {
      renderFriendSearchState('Network error while searching users.');
    }
  }, 260);
}

async function sendRequest(btn, toUserId) {
  if (!toUserId) {
    window.alert('Select a user from search results first.');
    return;
  }

  const token = getAuthToken();
  if (!token) {
    window.alert('Please sign in first.');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const response = await fetch(`${getApiBaseUrlFromWindow()}/api/friendships/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ toUserId })
    });

    const payload = await response.json();

    if (!response.ok) {
      btn.textContent = '+ Add';
      btn.disabled = false;
      window.alert(payload?.message || 'Failed to send friend request');
      return;
    }

    btn.textContent = '✓ Sent';
    btn.style.background = 'rgba(52,211,153,0.15)';
    btn.style.color = '#34d399';
    btn.style.borderColor = 'rgba(52,211,153,0.4)';

    // Keep socket emit for realtime notification if receiver is online.
    if (window.appSocket && window.appSocket.connected && typeof emitSocketEvent === 'function') {
      emitSocketEvent('friendship:request_send', { toUserId });
    }
  } catch (_) {
    btn.textContent = '+ Add';
    btn.disabled = false;
    window.alert('Network error while sending friend request.');
  }
}

function updateFriendRequestsLabel() {
  const label = document.getElementById('friend-requests-label');
  if (!label) return;
  label.textContent = `Requests (${window.pendingFriendRequests.length})`;
}

function updateFriendsCountLabel() {
  const label = document.getElementById('friends-count-label');
  if (!label) return;
  label.textContent = `Your Friends (${window.acceptedFriends.length})`;
}

function formatFriendSubLabel(friend) {
  const username = String(friend?.username || friend?.display_name || 'friend')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '');

  const presence = friend?.is_online ? 'Active now' : 'Offline';
  return `@${username} · ${presence}`;
}

function renderAcceptedFriends() {
  const container = document.getElementById('friends-list');
  if (!container) return;

  if (!window.acceptedFriends.length) {
    container.innerHTML = '<div style="padding:0 20px 10px;font-size:12px;color:var(--text3)">No friends yet. Add someone to start chatting.</div>';
    updateFriendsCountLabel();
    return;
  }

  container.innerHTML = window.acceptedFriends
    .map((friend) => {
      const id = escapeHtml(friend.id);
      const name = escapeHtml(friend.display_name || 'Unknown user');
      const sub = escapeHtml(formatFriendSubLabel(friend));
      const avatar = getInitialAvatar(friend.display_name || friend.username || '?');
      const onlineDot = friend.is_online
        ? '<div class="online-dot" style="position:absolute;right:2px;bottom:2px"></div>'
        : '';

      return `
        <div class="friend-item" data-friend-id="${id}" data-friend-name="${name}">
          <div class="avatar" style="width:48px;height:48px;font-size:22px;background:var(--bg4);border:none;position:relative">${avatar}${onlineDot}</div>
          <div class="friend-info"><div class="friend-name">${name}</div><div class="friend-username">${sub}</div></div>
          <div class="friend-action"><button class="btn-sm message" data-message-friend-id="${id}">Message</button></div>
        </div>
      `;
    })
    .join('');

  updateFriendsCountLabel();
}

async function openConversationWithFriend(friendId) {
  const friend = window.acceptedFriends.find((item) => item.id === friendId);
  if (!friend) {
    window.alert('Friend not found. Refresh and try again.');
    return;
  }

  try {
    const conversation = await createAndJoinConversation(friendId);

    if (conversation?.id && typeof window.openConversationById === 'function') {
      await window.openConversationById(conversation.id);
      return;
    }

    const chatName = document.getElementById('chat-name');
    const chatAvatar = document.getElementById('chat-av');
    if (chatName) chatName.textContent = friend.display_name || 'Chat';
    if (chatAvatar) {
      chatAvatar.textContent = getInitialAvatar(friend.display_name || friend.username || '?');
    }

    navigate('view-chat');

    if (conversation?.id) {
      window.activeConversationId = conversation.id;
    }
  } catch (error) {
    window.alert(error?.message || 'Failed to open conversation.');
  }
}

function getRequestAvatar(name) {
  return getInitialAvatar(name || '');
}

function renderPendingFriendRequests() {
  const container = document.getElementById('friend-requests-list');
  if (!container) return;

  if (!window.pendingFriendRequests.length) {
    container.innerHTML = '<div style="padding:0 20px 10px;font-size:12px;color:var(--text3)">No pending friend requests.</div>';
    updateFriendRequestsLabel();
    return;
  }

  container.innerHTML = window.pendingFriendRequests
    .map((request) => {
      const id = escapeHtml(request.id);
      const name = escapeHtml(request.fromUserName || 'Unknown user');
      const username = escapeHtml(request.fromUserName || 'user');
      const avatar = getRequestAvatar(request.fromUserName);

      return `
        <div class="friend-item" data-request-id="${id}">
          <div class="avatar" style="width:48px;height:48px;font-size:22px;background:var(--bg4);border:none">${avatar}</div>
          <div class="friend-info"><div class="friend-name">${name}</div><div class="friend-username">@${username}</div></div>
          <div class="friend-action">
            <button class="btn-sm accept" onclick="acceptFriendRequest('${id}', this)">Accept</button>
            <button class="btn-sm decline" onclick="declineFriendRequest('${id}', this)">✕</button>
          </div>
        </div>
      `;
    })
    .join('');

  updateFriendRequestsLabel();
}

function upsertPendingFriendRequest(request) {
  if (!request?.id) return;

  const existingIndex = window.pendingFriendRequests.findIndex((item) => item.id === request.id);
  if (existingIndex >= 0) {
    window.pendingFriendRequests[existingIndex] = request;
  } else {
    window.pendingFriendRequests.unshift(request);
  }

  renderPendingFriendRequests();
}

function removePendingFriendRequest(friendshipId) {
  window.pendingFriendRequests = window.pendingFriendRequests.filter((item) => item.id !== friendshipId);
  renderPendingFriendRequests();
}

function handleFriendRequestReceived(payload) {
  // Sender receives an ack object without fromUserId. Keep current button state for sender.
  if (!payload?.fromUserId) return;

  upsertPendingFriendRequest({
    id: payload.id,
    fromUserId: payload.fromUserId,
    fromUserName: payload.fromUserName || 'Unknown user',
    fromUserAvatar: payload.fromUserAvatar || null,
    createdAt: payload.createdAt
  });
}

function acceptFriendRequest(friendshipId, btn) {
  if (!window.appSocket || !window.appSocket.connected) {
    window.alert('Socket not connected. Reconnect first.');
    return;
  }

  if (btn) btn.disabled = true;
  emitSocketEvent('friendship:request_accept', { friendshipId });
  removePendingFriendRequest(friendshipId);
}

function declineFriendRequest(friendshipId, btn) {
  if (!window.appSocket || !window.appSocket.connected) {
    window.alert('Socket not connected. Reconnect first.');
    return;
  }

  if (btn) btn.disabled = true;
  emitSocketEvent('friendship:request_decline', { friendshipId });
  removePendingFriendRequest(friendshipId);
}

async function loadPendingFriendRequests() {
  const token = getAuthToken();
  if (!token) {
    renderPendingFriendRequests();
    return;
  }

  try {
    const response = await fetch(`${getApiBaseUrlFromWindow()}/api/friendships/requests/pending`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json();
    if (!response.ok) {
      renderPendingFriendRequests();
      return;
    }

    window.pendingFriendRequests = (payload.requests || []).map((request) => ({
      id: request.id,
      fromUserId: request.sender?.id || request.sender_id,
      fromUserName: request.sender?.display_name || request.sender?.username || 'Unknown user',
      fromUserAvatar: request.sender?.avatar_url || null,
      createdAt: request.created_at
    }));

    renderPendingFriendRequests();
  } catch (_) {
    renderPendingFriendRequests();
  }
}

async function loadAcceptedFriends() {
  const token = getAuthToken();
  if (!token) {
    window.acceptedFriends = [];
    renderAcceptedFriends();
    return;
  }

  try {
    const response = await fetch(`${getApiBaseUrlFromWindow()}/api/friendships?status=accepted`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json();
    if (!response.ok) {
      window.acceptedFriends = [];
      renderAcceptedFriends();
      return;
    }

    window.acceptedFriends = (payload.friendships || [])
      .map((item) => item.friend)
      .filter((friend) => friend && friend.id);

    renderAcceptedFriends();
  } catch (_) {
    window.acceptedFriends = [];
    renderAcceptedFriends();
  }
}

function handleFriendRequestAccepted() {
  loadPendingFriendRequests();
  loadAcceptedFriends();
}

window.handleFriendRequestReceived = handleFriendRequestReceived;
window.handleFriendRequestAccepted = handleFriendRequestAccepted;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.loadPendingFriendRequests = loadPendingFriendRequests;
window.loadAcceptedFriends = loadAcceptedFriends;

// Delegate dynamic Add buttons to avoid any stale inline handler issues.
document.addEventListener('click', (event) => {
  const addBtn = event.target.closest('[data-add-friend-id]');
  if (!addBtn) return;

  const toUserId = addBtn.getAttribute('data-add-friend-id');
  sendRequest(addBtn, toUserId);
});

document.addEventListener('click', (event) => {
  const messageBtn = event.target.closest('[data-message-friend-id]');
  if (messageBtn) {
    const friendId = messageBtn.getAttribute('data-message-friend-id');
    openConversationWithFriend(friendId);
    return;
  }

  const friendItem = event.target.closest('[data-friend-id]');
  if (!friendItem) return;

  const friendId = friendItem.getAttribute('data-friend-id');
  openConversationWithFriend(friendId);
});

// Explicitly expose modal/search actions for template onclick usage.
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAddFriendModal = closeAddFriendModal;
window.searchFriends = searchFriends;
window.searchFriendUsers = searchFriends;
window.sendRequest = sendRequest;

// Fallback listener so search still works even if inline oninput gets stale.
document.addEventListener('input', (event) => {
  const input = event.target;
  if (input && input.id === 'friend-search-input') {
    searchFriends(input.value);
  }
});
