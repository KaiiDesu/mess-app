function openThemePicker() {
  document.getElementById('theme-modal').classList.add('open');
}

function closeThemeModal(e) {
  if (e.target === document.getElementById('theme-modal')) {
    document.getElementById('theme-modal').classList.remove('open');
  }
}

function applyThemePreview(gradient) {
  document.querySelectorAll('.bubble.me').forEach(b => {
    b.style.background = gradient;
  });
  document.querySelector('.send-btn') && (document.querySelector('.send-btn').style.background = gradient);
  document.querySelectorAll('.voice-play').forEach(b => {
    b.style.background = gradient.replace('linear-gradient(135deg,', 'rgba(').split(',')[0] + ',.3)';
  });
}

async function parseThemeApiPayload(response) {
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

function formatThemeApiError(payload, fallbackMessage) {
  const code = payload?.code ? `[${payload.code}] ` : '';
  const message = payload?.message || fallbackMessage;
  return `${code}${message}`;
}

function selectTheme(el, name, gradient) {
  document.querySelectorAll('.theme-option').forEach(t => t.classList.remove('active'));
  if (el?.classList) {
    el.classList.add('active');
  }
  currentTheme = { name, gradient };
  window.currentTheme = currentTheme;
  applyThemePreview(gradient);
}

async function applyConversationTheme() {
  const token = localStorage.getItem('zap_jwt') || localStorage.getItem('token') || '';
  const conversationId = window.activeConversationId;

  if (!conversationId) {
    document.getElementById('theme-modal').classList.remove('open');
    return;
  }

  if (!token) {
    window.alert('Please sign in first.');
    return;
  }

  try {
    const response = await fetch(`${window.ZAP_API_URL || 'http://localhost:3000'}/api/conversations/${conversationId}/theme`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        themeName: currentTheme?.name || 'purple',
        themeGradient: currentTheme?.gradient || 'linear-gradient(135deg,#7c6bff,#a78bfa)'
      })
    });

    const payload = await parseThemeApiPayload(response);
    if (!response.ok) {
      window.alert(formatThemeApiError(payload, 'Failed to apply theme.'));
      return;
    }

    if (typeof emitSocketEvent === 'function') {
      emitSocketEvent('conversation:theme_update', {
        conversationId,
        themeName: currentTheme?.name || 'purple',
        themeGradient: currentTheme?.gradient || 'linear-gradient(135deg,#7c6bff,#a78bfa)'
      });
    }

    const conversation = (window.conversations || []).find((item) => item.id === conversationId);
    if (conversation) {
      conversation.theme_name = currentTheme?.name || conversation.theme_name;
      conversation.theme_gradient = currentTheme?.gradient || conversation.theme_gradient;
    }

    document.getElementById('theme-modal').classList.remove('open');
  } catch (_) {
    window.alert('Network error while applying theme.');
  }
}

window.applyConversationTheme = applyConversationTheme;
window.applyThemePreview = applyThemePreview;
