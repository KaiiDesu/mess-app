function navigate(viewId) {
  const current = document.getElementById(currentView);
  const next = document.getElementById(viewId);
  if (!next) return;

  if (currentView === 'view-chat' && viewId !== 'view-chat') {
    const msgInput = document.getElementById('msg-input');
    if (msgInput && document.activeElement === msgInput) {
      msgInput.blur();
    }
  }

  // If user leaves chat screen, clear active realtime conversation context.
  if (currentView === 'view-chat' && viewId !== 'view-chat' && window.activeConversationId) {
    if (typeof window.pauseAllInlineChatVideos === 'function') {
      window.pauseAllInlineChatVideos();
    }

    if (typeof leaveConversation === 'function') {
      leaveConversation(window.activeConversationId);
    } else {
      window.activeConversationId = null;
    }
  }

  const goingBack = viewId === 'view-home' || viewId === 'view-login' || viewId === 'view-register';
  if (goingBack) {
    current.classList.add('hidden');
    current.classList.remove('slide-left');
  } else {
    current.classList.add('slide-left');
    current.classList.remove('hidden');
  }
  next.classList.remove('hidden', 'slide-left');
  currentView = viewId;
}

function switchTab(el, viewId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  navigate(viewId);
}

function openChat(name, emoji, theme, viewId) {
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-av').innerHTML = emoji;
  navigate(viewId);
  buildWaveform('waveform-demo', 28);
}
