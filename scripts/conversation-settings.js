function getSettingsApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getSettingsAuthToken() {
  return localStorage.getItem('zap_jwt') || localStorage.getItem('token') || '';
}

function getActiveConversationFromState() {
  if (!window.activeConversationId) return null;
  return (window.conversations || []).find((item) => item.id === window.activeConversationId) || null;
}

function getDisplayNameForConversation(conversation) {
  const otherUser = conversation?.otherUser || {};
  return otherUser.nickname || otherUser.display_name || 'Conversation';
}

async function parseApiPayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (_) {
      return {};
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : {};
  } catch (_) {
    return {};
  }
}

function formatApiError(payload, fallbackMessage) {
  const code = payload?.code ? `[${payload.code}] ` : '';
  const message = payload?.message || fallbackMessage;
  return `${code}${message}`;
}

function openConversationSettings() {
  const conversation = getActiveConversationFromState();
  if (!conversation) {
    window.alert('Open a conversation first.');
    return;
  }

  const otherUser = conversation.otherUser || {};

  const avatar = document.getElementById('conv-settings-avatar');
  if (avatar) {
    const initial = typeof getInitialAvatar === 'function' ? getInitialAvatar(otherUser.display_name || 'U') : 'U';
    avatar.textContent = initial;
  }

  const name = document.getElementById('conv-settings-name');
  if (name) {
    name.textContent = getDisplayNameForConversation(conversation);
  }

  const username = document.getElementById('conv-settings-username');
  if (username) {
    const handle = String(otherUser.username || otherUser.display_name || 'user')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    username.textContent = `@${handle}`;
  }

  const status = document.getElementById('conv-settings-status');
  if (status) {
    status.textContent = otherUser.is_online ? 'Active now' : 'Offline';
  }

  const modal = document.getElementById('conversation-settings-modal');
  if (modal) {
    modal.classList.add('open');
  }
}

function closeConversationSettings(event) {
  if (event && event.target && event.target.id !== 'conversation-settings-modal') {
    return;
  }

  const modal = document.getElementById('conversation-settings-modal');
  if (modal) {
    modal.classList.remove('open');
  }
}

function openConversationThemeFromSettings() {
  closeConversationSettings();
  if (typeof openThemePicker === 'function') {
    openThemePicker();
  }
}

async function changeConversationNickname() {
  const conversation = getActiveConversationFromState();
  if (!conversation) {
    window.alert('Open a conversation first.');
    return;
  }

  const token = getSettingsAuthToken();
  if (!token) {
    window.alert('Please sign in first.');
    return;
  }

  const currentNickname = conversation?.otherUser?.nickname || '';
  const suggested = currentNickname || conversation?.otherUser?.display_name || '';
  const nextValue = window.prompt('Set a nickname for this person (leave blank to reset):', suggested);

  if (nextValue === null) {
    return;
  }

  const response = await fetch(`${getSettingsApiBaseUrl()}/api/conversations/${conversation.id}/nickname`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ nickname: nextValue })
  });

  const payload = await parseApiPayload(response);
  if (!response.ok) {
    window.alert(formatApiError(payload, 'Failed to update nickname.'));
    return;
  }

  conversation.otherUser = {
    ...(conversation.otherUser || {}),
    nickname: payload.nickname || null
  };

  if (typeof renderConversationList === 'function') {
    renderConversationList(window.conversations || []);
  }

  if (window.activeConversationId === conversation.id) {
    const chatName = document.getElementById('chat-name');
    if (chatName) {
      chatName.textContent = getDisplayNameForConversation(conversation);
    }
  }

  openConversationSettings();
}

async function deleteCurrentConversation() {
  const conversation = getActiveConversationFromState();
  if (!conversation) {
    window.alert('Open a conversation first.');
    return;
  }

  const shouldDelete = window.confirm(
    'Delete this conversation for you? Existing messages will be hidden for you, while the other user keeps their history.'
  );
  if (!shouldDelete) {
    return;
  }

  const token = getSettingsAuthToken();
  if (!token) {
    window.alert('Please sign in first.');
    return;
  }

  const response = await fetch(`${getSettingsApiBaseUrl()}/api/conversations/${conversation.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await parseApiPayload(response);
  if (!response.ok) {
    window.alert(formatApiError(payload, 'Failed to delete conversation.'));
    return;
  }

  closeConversationSettings();

  window.conversations = (window.conversations || []).filter((item) => item.id !== conversation.id);
  if (typeof renderConversationList === 'function') {
    renderConversationList(window.conversations);
  }

  if (window.activeConversationId === conversation.id) {
    window.activeConversationId = null;
    if (typeof navigate === 'function') {
      navigate('view-home');
    }
  }
}

window.openConversationSettings = openConversationSettings;
window.closeConversationSettings = closeConversationSettings;
window.openConversationThemeFromSettings = openConversationThemeFromSettings;
window.changeConversationNickname = changeConversationNickname;
window.deleteCurrentConversation = deleteCurrentConversation;
