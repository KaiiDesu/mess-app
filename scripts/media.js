let hiddenMediaInput = null;
const MAX_MEDIA_SIZE_BYTES = 25 * 1024 * 1024;
const PENDING_MEDIA_STORAGE_KEY = 'zap_pending_media_messages';
const PENDING_MEDIA_MAX_AGE_MS = 3 * 60 * 1000;

window.pendingMediaPreviewUrls = window.pendingMediaPreviewUrls || {};

function setPendingMediaPreviewUrl(clientMessageId, mediaUrl) {
  if (!clientMessageId || !mediaUrl) return;
  window.pendingMediaPreviewUrls[clientMessageId] = mediaUrl;
}

function getPendingMediaPreviewUrl(clientMessageId) {
  if (!clientMessageId) return '';
  return window.pendingMediaPreviewUrls[clientMessageId] || '';
}

function clearPendingMediaPreviewUrl(clientMessageId) {
  if (!clientMessageId) return;
  const mediaUrl = window.pendingMediaPreviewUrls[clientMessageId];
  if (mediaUrl && mediaUrl.startsWith('blob:')) {
    URL.revokeObjectURL(mediaUrl);
  }
  delete window.pendingMediaPreviewUrls[clientMessageId];
}

function isFreshPendingMediaEntry(entry, nowMs = Date.now()) {
  if (!entry || !entry.clientMessageId || !entry.conversationId) return false;
  if (entry.status && entry.status !== 'sending') return false;

  const createdAtMs = new Date(entry.createdAt || 0).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  return nowMs - createdAtMs <= PENDING_MEDIA_MAX_AGE_MS;
}

function normalizePendingMediaEntries(entries) {
  const nowMs = Date.now();
  return (Array.isArray(entries) ? entries : []).filter((entry) => isFreshPendingMediaEntry(entry, nowMs));
}

function readPendingMediaEntries() {
  try {
    const raw = localStorage.getItem(PENDING_MEDIA_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const normalized = normalizePendingMediaEntries(parsed);

    if (!Array.isArray(parsed) || normalized.length !== parsed.length) {
      writePendingMediaEntries(normalized);
    }

    return normalized;
  } catch (_) {
    return [];
  }
}

function writePendingMediaEntries(entries) {
  localStorage.setItem(PENDING_MEDIA_STORAGE_KEY, JSON.stringify(entries));
}

function upsertPendingMediaEntry(entry) {
  if (!entry?.clientMessageId) return;

  const entries = readPendingMediaEntries();
  const index = entries.findIndex((item) => item.clientMessageId === entry.clientMessageId);

  if (index >= 0) {
    entries[index] = {
      ...entries[index],
      ...entry
    };
  } else {
    entries.push(entry);
  }

  writePendingMediaEntries(entries);
}

function removePendingMediaEntry(clientMessageId) {
  if (!clientMessageId) return;
  const entries = readPendingMediaEntries().filter((item) => item.clientMessageId !== clientMessageId);
  writePendingMediaEntries(entries);
}

function getPendingMediaForConversation(conversationId) {
  if (!conversationId) return [];
  return readPendingMediaEntries().filter((item) => item.conversationId === conversationId);
}

window.getPendingMediaForConversation = getPendingMediaForConversation;
window.removePendingMediaEntry = removePendingMediaEntry;
window.getPendingMediaPreviewUrl = getPendingMediaPreviewUrl;
window.clearPendingMediaPreviewUrl = clearPendingMediaPreviewUrl;

function getMediaApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getMediaAuthToken() {
  if (typeof window.getStoredAuthToken === 'function') {
    return window.getStoredAuthToken();
  }
  return (
    localStorage.getItem('zap_jwt') ||
    sessionStorage.getItem('zap_jwt') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}

function ensureMediaInput() {
  if (hiddenMediaInput) return hiddenMediaInput;

  hiddenMediaInput = document.createElement('input');
  hiddenMediaInput.type = 'file';
  hiddenMediaInput.accept = 'image/*,video/*';
  hiddenMediaInput.style.display = 'none';
  hiddenMediaInput.addEventListener('change', onMediaFileSelected);
  document.body.appendChild(hiddenMediaInput);
  return hiddenMediaInput;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadMediaFile(file) {
  const token = getMediaAuthToken();
  if (!token) {
    throw new Error('Please sign in first.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch(`${getMediaApiBaseUrl()}/api/media/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      dataUrl,
      fileName: file.name,
      mimeType: file.type
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const code = payload?.code ? `[${payload.code}] ` : '';
    throw new Error(`${code}${payload?.message || 'Upload failed'}`);
  }

  return payload;
}

function inferMediaType(file) {
  if (String(file?.type || '').startsWith('video/')) {
    return 'video';
  }
  return 'image';
}

function removePendingMediaMessage(clientMessageId) {
  if (!clientMessageId) return;

  removePendingMediaEntry(clientMessageId);
  clearPendingMediaPreviewUrl(clientMessageId);

  const row = document.querySelector(`.msg-row.me[data-client-message-id="${clientMessageId}"]`);
  if (!row) return;

  if (row.dataset.objectUrl) {
    URL.revokeObjectURL(row.dataset.objectUrl);
  }

  row.remove();

  if (typeof recomputeOutgoingStatusVisibility === 'function') {
    recomputeOutgoingStatusVisibility();
  }
}

async function onMediaFileSelected(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const input = event.target;
  if (input) {
    input.value = '';
  }

  if (!window.activeConversationId) {
    window.alert('Open a conversation first.');
    return;
  }

  const targetConversationId = window.activeConversationId;

  if (!window.appSocket || !window.appSocket.connected) {
    window.alert('Socket not connected. Reconnect first.');
    return;
  }

  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    window.alert(`File is ${sizeMb}MB. Maximum allowed size is 25MB.`);
    return;
  }

  const mediaType = inferMediaType(file);
  const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localPreviewUrl = URL.createObjectURL(file);
  setPendingMediaPreviewUrl(clientMessageId, localPreviewUrl);

  window.pendingClientMessageIds.add(clientMessageId);
  upsertPendingMediaEntry({
    clientMessageId,
    conversationId: targetConversationId,
    contentType: mediaType,
    fileName: file.name,
    createdAt: new Date().toISOString(),
    status: 'sending'
  });

  if (typeof addMessage === 'function') {
    addMessage(localPreviewUrl, true, false, clientMessageId, {
      contentType: mediaType,
      fileName: file.name,
      mediaUrl: localPreviewUrl,
      deliveryStatus: mediaType === 'video' ? 'Sent' : 'Sent',
      createdAt: new Date().toISOString(),
      showVideoLoading: mediaType === 'video',
      objectUrl: localPreviewUrl
    });
  }

  try {
    const uploaded = await uploadMediaFile(file);

    if (typeof updateMessageMediaByClientId === 'function') {
      updateMessageMediaByClientId(clientMessageId, uploaded.mediaUrl, mediaType);
    }

    if (typeof emitSocketEvent === 'function') {
      emitSocketEvent('message:send', {
        conversationId: targetConversationId,
        contentType: mediaType,
        mediaId: uploaded.mediaId,
        fileName: uploaded.fileName,
        clientMessageId
      });
    }
  } catch (error) {
    window.pendingClientMessageIds.delete(clientMessageId);
    removePendingMediaMessage(clientMessageId);
    window.alert(error?.message || 'Failed to send media.');
  }
}

function triggerMediaPicker() {
  const input = ensureMediaInput();
  input.click();
}

function openMedia(mediaUrl, fileType) {
  const modal = document.getElementById('media-modal');
  if (!modal) return;

  const existingVideo = modal.querySelector('video');
  if (existingVideo) {
    existingVideo.remove();
  }

  const image = modal.querySelector('img');
  if (!image) return;

  if (fileType === 'video') {
    image.style.display = 'none';
    const video = document.createElement('video');
    video.src = mediaUrl;
    video.controls = true;
    video.style.maxWidth = '100%';
    video.style.maxHeight = '80%';
    video.style.borderRadius = '12px';
    modal.appendChild(video);
  } else if (mediaUrl) {
    image.style.display = 'block';
    image.src = mediaUrl;
  }

  modal.classList.add('open');
}

function setBubblePlayingState(videoEl, isPlaying) {
  const bubble = videoEl?.closest('.media-bubble[data-media-type="video"]');
  if (!bubble) return;
  bubble.classList.toggle('is-playing', Boolean(isPlaying));
}

function requestVideoFullscreen(videoEl) {
  if (!videoEl) return;

  if (videoEl.requestFullscreen) {
    videoEl.requestFullscreen();
    return;
  }

  if (videoEl.webkitRequestFullscreen) {
    videoEl.webkitRequestFullscreen();
  }
}

function pauseInlineVideo(videoEl) {
  if (!(videoEl instanceof HTMLVideoElement)) return;

  if (!videoEl.paused && !videoEl.ended) {
    videoEl.pause();
  }

  setBubblePlayingState(videoEl, false);
}

function pauseAllInlineChatVideos() {
  const videos = document.querySelectorAll('#messages-container .media-bubble[data-media-type="video"] video');
  videos.forEach((videoEl) => pauseInlineVideo(videoEl));
}

function isVideoVisibleInContainer(videoEl, containerEl) {
  if (!videoEl || !containerEl) return false;

  const videoRect = videoEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  return (
    videoRect.bottom > containerRect.top &&
    videoRect.top < containerRect.bottom &&
    videoRect.right > containerRect.left &&
    videoRect.left < containerRect.right
  );
}

function pauseInlineVideosOutOfView() {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const videos = container.querySelectorAll('.media-bubble[data-media-type="video"] video');
  videos.forEach((videoEl) => {
    if (!isVideoVisibleInContainer(videoEl, container)) {
      pauseInlineVideo(videoEl);
    }
  });
}

let pauseCheckRafId = null;

function schedulePauseInlineVideosOutOfView() {
  if (pauseCheckRafId !== null) return;

  pauseCheckRafId = window.requestAnimationFrame(() => {
    pauseCheckRafId = null;
    pauseInlineVideosOutOfView();
  });
}

function bindInlineVideoAutoPause() {
  const container = document.getElementById('messages-container');
  if (!container || container.dataset.videoAutopauseBound === '1') return;

  container.dataset.videoAutopauseBound = '1';
  container.addEventListener('scroll', schedulePauseInlineVideosOutOfView, { passive: true });
}

window.pauseAllInlineChatVideos = pauseAllInlineChatVideos;
window.pauseInlineVideosOutOfView = pauseInlineVideosOutOfView;

document.addEventListener('click', async (event) => {
  const playBtn = event.target.closest('.video-inline-play');
  if (!playBtn) return;

  event.preventDefault();
  event.stopPropagation();

  const bubble = playBtn.closest('.media-bubble[data-media-type="video"]');
  const videoEl = bubble?.querySelector('video');
  if (!videoEl) return;

  videoEl.controls = true;

  try {
    await videoEl.play();
    setBubblePlayingState(videoEl, true);
    schedulePauseInlineVideosOutOfView();
  } catch (_) {
    setBubblePlayingState(videoEl, false);
  }
});

document.addEventListener('play', (event) => {
  const videoEl = event.target;
  if (!(videoEl instanceof HTMLVideoElement)) return;
  if (!videoEl.closest('.media-bubble[data-media-type="video"]')) return;
  setBubblePlayingState(videoEl, true);
}, true);

document.addEventListener('pause', (event) => {
  const videoEl = event.target;
  if (!(videoEl instanceof HTMLVideoElement)) return;
  if (!videoEl.closest('.media-bubble[data-media-type="video"]')) return;
  setBubblePlayingState(videoEl, false);
}, true);

document.addEventListener('ended', (event) => {
  const videoEl = event.target;
  if (!(videoEl instanceof HTMLVideoElement)) return;
  if (!videoEl.closest('.media-bubble[data-media-type="video"]')) return;
  setBubblePlayingState(videoEl, false);
}, true);

document.addEventListener('click', (event) => {
  const videoEl = event.target.closest('.media-bubble[data-media-type="video"] video');
  if (!videoEl) return;

  // If already playing, second tap/click promotes to fullscreen.
  if (!videoEl.paused && !videoEl.ended) {
    requestVideoFullscreen(videoEl);
  }
});

document.addEventListener('click', (event) => {
  const mediaBubble = event.target.closest('[data-open-media="1"]');
  if (!mediaBubble) return;

  const mediaUrl = mediaBubble.getAttribute('data-media-url');
  const mediaType = mediaBubble.getAttribute('data-media-type') || 'image';
  if (mediaType === 'video') return;
  if (!mediaUrl) return;

  openMedia(mediaUrl, mediaType);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAllInlineChatVideos();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindInlineVideoAutoPause);
} else {
  bindInlineVideoAutoPause();
}

document.addEventListener('click', (event) => {
  const closeBtn = event.target.closest('.media-close');
  if (!closeBtn) return;

  const modal = document.getElementById('media-modal');
  if (!modal) return;

  const image = modal.querySelector('img');
  if (image) {
    image.style.display = 'block';
  }

  const video = modal.querySelector('video');
  if (video) {
    video.remove();
  }
});
