const MAIN_TAB_VIEWS = ['view-home', 'view-friends', 'view-profile'];

function syncBottomNavActive(viewId) {
  const activeIndexByView = {
    'view-home': 0,
    'view-friends': 1,
    'view-profile': 2
  };

  const activeIndex = activeIndexByView[viewId];
  if (typeof activeIndex !== 'number') return;

  document.querySelectorAll('.bottom-nav').forEach((nav) => {
    const items = [...nav.querySelectorAll('.nav-item')];
    items.forEach((item) => item.classList.remove('active'));
    if (items[activeIndex]) {
      items[activeIndex].classList.add('active');
    }
  });
}

function getMainTabContentLayer(view) {
  if (!view) return null;

  if (!MAIN_TAB_VIEWS.includes(view.id)) {
    return null;
  }

  let layer = view.querySelector(':scope > .tab-transition-layer');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.className = 'tab-transition-layer';

  const nav = view.querySelector(':scope > .bottom-nav');
  const children = [...view.children];
  children.forEach((child) => {
    if (child === nav) return;
    layer.appendChild(child);
  });

  if (nav) {
    view.insertBefore(layer, nav);
  } else {
    view.appendChild(layer);
  }

  return layer;
}

function cleanupNonMainTabTransitionLayers() {
  const allViews = [...document.querySelectorAll('.view')];
  allViews.forEach((view) => {
    if (MAIN_TAB_VIEWS.includes(view.id)) return;

    const layer = view.querySelector(':scope > .tab-transition-layer');
    if (!layer) return;

    const nodes = [...layer.childNodes];
    nodes.forEach((node) => view.insertBefore(node, layer));
    layer.remove();
  });
}

function ensureMainTabTransitionLayers() {
  cleanupNonMainTabTransitionLayers();

  MAIN_TAB_VIEWS.forEach((viewId) => {
    const view = document.getElementById(viewId);
    if (!view) return;

    const isActiveMainView = currentView === viewId;

    // Keep main-tab containers stationary; animate only the inner transition layer.
    view.classList.remove('hidden', 'slide-left');
    view.classList.toggle('tab-hidden', !isActiveMainView);

    const layer = getMainTabContentLayer(view);
    if (!layer) return;

    const shouldBeHidden = view.classList.contains('tab-hidden');
    layer.classList.toggle('hidden', shouldBeHidden);
    layer.classList.remove('slide-left');
  });
}

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

  ensureMainTabTransitionLayers();

  const currentMainIndex = MAIN_TAB_VIEWS.indexOf(currentView);
  const nextMainIndex = MAIN_TAB_VIEWS.indexOf(viewId);
  const isMainTabTransition = currentMainIndex >= 0 && nextMainIndex >= 0;

  if (isMainTabTransition) {
    // Requested behavior:
    // Chats -> Friends/Profile => slide right
    // Profile -> Chats/Friends => slide left
    const currentLayer = getMainTabContentLayer(current);
    const nextLayer = getMainTabContentLayer(next);

    const slideRight = nextMainIndex > currentMainIndex;
    if (slideRight) {
      currentLayer?.classList.add('hidden');
      currentLayer?.classList.remove('slide-left');
    } else {
      currentLayer?.classList.add('slide-left');
      currentLayer?.classList.remove('hidden');
    }

    current.classList.add('tab-hidden');
    current.classList.remove('hidden', 'slide-left');

    next.classList.remove('hidden', 'slide-left', 'tab-hidden');
    nextLayer?.classList.remove('hidden', 'slide-left');
  } else {
    current.classList.remove('tab-hidden');
    next.classList.remove('tab-hidden');

    const goingBack = viewId === 'view-home' || viewId === 'view-login' || viewId === 'view-register';
    if (goingBack) {
      current.classList.add('hidden');
      current.classList.remove('slide-left');
    } else {
      current.classList.add('slide-left');
      current.classList.remove('hidden');
    }

    const currentLayer = MAIN_TAB_VIEWS.includes(current.id) ? getMainTabContentLayer(current) : null;
    if (currentLayer) {
      const shouldHideLayer = current.classList.contains('hidden') || current.classList.contains('tab-hidden');
      currentLayer.classList.toggle('hidden', shouldHideLayer);
      if (!current.classList.contains('slide-left')) {
        currentLayer.classList.remove('slide-left');
      }
    }

    const nextLayer = MAIN_TAB_VIEWS.includes(next.id) ? getMainTabContentLayer(next) : null;
    if (nextLayer) {
      nextLayer.classList.remove('hidden', 'slide-left');
    }
  }

  if (!isMainTabTransition) {
    next.classList.remove('hidden', 'slide-left');
  }

  syncBottomNavActive(viewId);

  currentView = viewId;
}

function switchTab(el, viewId) {
  syncBottomNavActive(viewId);
  navigate(viewId);
}

function openChat(name, emoji, theme, viewId) {
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-av').innerHTML = emoji;
  navigate(viewId);
  buildWaveform('waveform-demo', 28);
}

document.addEventListener('DOMContentLoaded', () => {
  ensureMainTabTransitionLayers();
});
