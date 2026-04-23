const NOTE_MAX_CHARS = 60;
const NOTE_TTL_HOURS = 24;

window.zapNotes = window.zapNotes || [];
window.__zapActiveNoteUserId = null;
window.__zapNoteEditing = false;
window.__zapOriginalNoteText = '';

function getNotesApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

function getNotesAuthToken() {
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

function getCurrentNotesUserId() {
  try {
    const user =
      (typeof window.getStoredSessionUser === 'function' && window.getStoredSessionUser()) ||
      JSON.parse(localStorage.getItem('zap_user') || sessionStorage.getItem('zap_user') || '{}');
    return user.id || null;
  } catch (_) {
    return null;
  }
}

function parseNotesServerDate(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return new Date(NaN);

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  return new Date(candidate);
}

function escapeNotesHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isNoteExpired(note) {
  const expiresAt = parseNotesServerDate(note?.expires_at || note?.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return true;
  return expiresAt.getTime() <= Date.now();
}

function getNoteAvatar(name) {
  const text = String(name || '').trim();
  return text ? text.charAt(0).toUpperCase() : '•';
}

function getMineNote() {
  const userId = getCurrentNotesUserId();
  if (!userId) return null;
  return (window.zapNotes || []).find((item) => item.user_id === userId || item.userId === userId) || null;
}

function getNoteByUserId(userId) {
  if (!userId) return null;
  return (window.zapNotes || []).find((item) => (item.user_id || item.userId) === userId) || null;
}

function getNoteAgeLabel(note) {
  const createdAt = parseNotesServerDate(note?.updated_at || note?.updatedAt || note?.created_at);
  if (Number.isNaN(createdAt.getTime())) return '';
  const diffMs = Math.max(0, Date.now() - createdAt.getTime());
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

function setNoteFullscreenVisible(isVisible) {
  const panel = document.getElementById('note-fullscreen');
  if (!panel) return;
  panel.classList.toggle('hidden', !isVisible);
}

function setNoteBubbleEditable(isEditable) {
  const bubble = document.getElementById('note-fullscreen-bubble');
  if (!bubble) return;

  bubble.setAttribute('contenteditable', isEditable ? 'true' : 'false');
  bubble.setAttribute('spellcheck', isEditable ? 'true' : 'false');

  if (isEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(bubble);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    bubble.focus();
  }
}

function getActiveBubbleText() {
  const bubble = document.getElementById('note-fullscreen-bubble');
  if (!bubble) return '';
  return String(bubble.textContent || '').replace(/\s+/g, ' ').trim();
}

function refreshNoteEditCounter() {
  const count = document.getElementById('note-fullscreen-count');
  if (!count) return;

  const length = getActiveBubbleText().length;
  count.textContent = `${Math.min(length, NOTE_MAX_CHARS)}/${NOTE_MAX_CHARS}`;
}

function syncNoteActionButtons(isMine, isEditing) {
  const left = document.getElementById('note-left-action');
  const right = document.getElementById('note-right-action');
  const count = document.getElementById('note-fullscreen-count');

  if (!left || !right) return;

  if (!isMine) {
    left.classList.add('hidden');
    right.classList.add('hidden');
    if (count) {
      count.classList.add('hidden');
    }
    return;
  }

  left.classList.remove('hidden');
  right.classList.remove('hidden');

  if (isEditing) {
    left.textContent = 'Cancel';
    right.textContent = 'Post';
    if (count) {
      count.classList.remove('hidden');
      refreshNoteEditCounter();
    }
  } else {
    left.textContent = 'See activity';
    right.textContent = 'Replace note';
    if (count) {
      count.classList.add('hidden');
    }
  }
}

function openNoteEditor() {
  const me = getCurrentNotesUserId();
  const note = getNoteByUserId(me);
  const bubble = document.getElementById('note-fullscreen-bubble');

  if (!bubble) return;

  window.__zapNoteEditing = true;
  window.__zapOriginalNoteText = note?.content || '';

  if (!note) {
    bubble.textContent = '';
  }

  setNoteBubbleEditable(true);
  syncNoteActionButtons(true, true);
}

function closeNoteEditor() {
  const bubble = document.getElementById('note-fullscreen-bubble');
  const isMine = window.__zapActiveNoteUserId && window.__zapActiveNoteUserId === getCurrentNotesUserId();

  window.__zapNoteEditing = false;

  if (bubble) {
    bubble.textContent = window.__zapOriginalNoteText || bubble.textContent || '';
  }

  setNoteBubbleEditable(false);
  syncNoteActionButtons(Boolean(isMine), false);
}

function onNoteLeftAction() {
  const isMine = window.__zapActiveNoteUserId && window.__zapActiveNoteUserId === getCurrentNotesUserId();
  if (!isMine) return;

  if (window.__zapNoteEditing) {
    closeNoteEditor();
    openNoteProfile(getCurrentNotesUserId());
    return;
  }

  // Placeholder for future activity screen.
}

function onNoteRightAction() {
  const isMine = window.__zapActiveNoteUserId && window.__zapActiveNoteUserId === getCurrentNotesUserId();
  if (!isMine) return;

  if (window.__zapNoteEditing) {
    saveMyNote();
    return;
  }

  openNoteEditor();
}

function openNoteProfile(userId) {
  const me = getCurrentNotesUserId();
  const targetUserId = userId || me;
  const note = getNoteByUserId(targetUserId);
  const isMine = targetUserId === me;

  window.__zapActiveNoteUserId = targetUserId;

  const bubble = document.getElementById('note-fullscreen-bubble');
  const avatar = document.getElementById('note-fullscreen-avatar');
  const name = document.getElementById('note-fullscreen-name');
  const meta = document.getElementById('note-fullscreen-meta');
  const actions = document.getElementById('note-fullscreen-actions');

  if (!bubble || !avatar || !name || !meta) return;

  const displayName = isMine
    ? 'You'
    : note?.display_name || note?.userName || 'Friend';
  const content = note?.content || (isMine ? 'Share a quick note...' : 'No note yet');
  const age = note ? getNoteAgeLabel(note) : '';

  bubble.textContent = content;
  avatar.textContent = getNoteAvatar(displayName);
  name.textContent = displayName;
  meta.textContent = note ? `${age ? `${age} · ` : ''}Shared with Friends · Expires in 24h` : 'Shared with Friends · Expires in 24h';

  window.__zapNoteEditing = false;
  window.__zapOriginalNoteText = note?.content || '';
  setNoteBubbleEditable(false);

  if (actions) {
    actions.classList.toggle('hidden', !isMine);
  }
  syncNoteActionButtons(isMine, false);

  setNoteFullscreenVisible(true);

  if (isMine && !note) {
    openNoteEditor();
  }
}

function upsertNoteInState(note) {
  if (!note?.user_id && !note?.userId) return;

  const userId = note.user_id || note.userId;
  const list = Array.isArray(window.zapNotes) ? [...window.zapNotes] : [];
  const next = {
    ...note,
    user_id: userId
  };

  const existingIndex = list.findIndex((item) => (item.user_id || item.userId) === userId);
  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      ...next
    };
  } else {
    list.unshift(next);
  }

  window.zapNotes = list.filter((item) => !isNoteExpired(item));
}

function removeNoteFromState(userId) {
  if (!userId) return;
  const list = Array.isArray(window.zapNotes) ? window.zapNotes : [];
  window.zapNotes = list.filter((item) => (item.user_id || item.userId) !== userId);
}

function renderNotesStrip() {
  const row = document.getElementById('notes-row');
  if (!row) return;

  const me = getCurrentNotesUserId();
  const notes = (Array.isArray(window.zapNotes) ? window.zapNotes : [])
    .filter((item) => !isNoteExpired(item))
    .sort((a, b) => {
      const aTime = parseNotesServerDate(a.updated_at || a.updatedAt || a.created_at).getTime();
      const bTime = parseNotesServerDate(b.updated_at || b.updatedAt || b.created_at).getTime();
      return bTime - aTime;
    });

  const myNote = notes.find((item) => (item.user_id || item.userId) === me) || null;
  const others = notes.filter((item) => (item.user_id || item.userId) !== me);

  const selfCard = myNote
    ? `
      <div class="note-item mine" onclick="openNoteComposer()">
        <div class="note-avatar-wrap">
          <div class="note-avatar">${getNoteAvatar(myNote.display_name || myNote.userName || 'You')}</div>
          <div class="note-bubble">${escapeNotesHtml(String(myNote.content || ''))}</div>
        </div>
        <div class="note-name">You</div>
      </div>
    `
    : `
      <div class="note-item add" onclick="openNoteComposer()">
        <div class="note-avatar-wrap"><div class="note-avatar">+</div></div>
        <div class="note-name">Your note</div>
      </div>
    `;

  const otherCards = others
    .map((note) => {
      const userId = note.user_id || note.userId;
      const displayName = note.display_name || note.userName || 'Friend';
      const content = String(note.content || '').trim();
      return `
        <div class="note-item" data-user-id="${escapeNotesHtml(userId)}" onclick="openNoteProfile('${escapeNotesHtml(userId)}')">
          <div class="note-avatar-wrap">
            <div class="note-avatar">${getNoteAvatar(displayName)}</div>
            <div class="note-bubble">${escapeNotesHtml(content)}</div>
          </div>
          <div class="note-name">${escapeNotesHtml(displayName)}</div>
        </div>
      `;
    })
    .join('');

  row.innerHTML = `${selfCard}${otherCards}`;

  if (!myNote && !others.length) {
    row.innerHTML = `${selfCard}<div class="note-empty">No active notes yet.</div>`;
  }
}

function onNoteInputChange(el) {
  const bubble = document.getElementById('note-fullscreen-bubble');
  if (!bubble || !window.__zapNoteEditing) return;

  const value = getActiveBubbleText();
  if (value.length > NOTE_MAX_CHARS) {
    bubble.textContent = value.slice(0, NOTE_MAX_CHARS);
    setNoteBubbleEditable(true);
  }

  refreshNoteEditCounter();
}

function openNoteComposer() {
  openNoteProfile(getCurrentNotesUserId());
}

function closeNoteComposer() {
  setNoteFullscreenVisible(false);
  window.__zapNoteEditing = false;
  setNoteBubbleEditable(false);
  window.__zapActiveNoteUserId = null;
}

async function loadNotes() {
  const token = getNotesAuthToken();
  if (!token) {
    window.zapNotes = [];
    renderNotesStrip();
    return;
  }

  try {
    const response = await fetch(`${getNotesApiBaseUrl()}/api/notes`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      renderNotesStrip();
      return;
    }

    const payload = await response.json().catch(() => ({}));
    const notes = Array.isArray(payload.notes) ? payload.notes : [];
    window.zapNotes = notes.filter((item) => !isNoteExpired(item));
    renderNotesStrip();
  } catch (_) {
    renderNotesStrip();
  }
}

async function saveMyNote() {
  const isMine = window.__zapActiveNoteUserId && window.__zapActiveNoteUserId === getCurrentNotesUserId();
  if (!isMine) return;

  const rightButton = document.getElementById('note-right-action');
  const leftButton = document.getElementById('note-left-action');

  const content = getActiveBubbleText();
  if (!content || content.length > NOTE_MAX_CHARS) {
    refreshNoteEditCounter();
    return;
  }

  const token = getNotesAuthToken();
  if (!token) return;

  if (rightButton) rightButton.disabled = true;
  if (leftButton) leftButton.disabled = true;

  try {
    const response = await fetch(`${getNotesApiBaseUrl()}/api/notes/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (rightButton) rightButton.disabled = false;
      if (leftButton) leftButton.disabled = false;
      return;
    }

    if (payload?.note) {
      upsertNoteInState(payload.note);
      renderNotesStrip();
    }

    window.__zapNoteEditing = false;
    setNoteBubbleEditable(false);
    openNoteProfile(getCurrentNotesUserId());
  } catch (_) {
    // Ignore transient network failures; socket sync or next refresh can reconcile.
  } finally {
    if (rightButton) rightButton.disabled = false;
    if (leftButton) leftButton.disabled = false;
  }
}

function handleIncomingNoteUpsert(payload) {
  if (!payload?.note) return;
  upsertNoteInState(payload.note);
  renderNotesStrip();
}

function handleIncomingNoteDelete(payload) {
  const userId = payload?.userId;
  if (!userId) return;
  removeNoteFromState(userId);
  renderNotesStrip();
}

window.openNoteComposer = openNoteComposer;
window.closeNoteComposer = closeNoteComposer;
window.openNoteProfile = openNoteProfile;
window.openNoteEditor = openNoteEditor;
window.closeNoteEditor = closeNoteEditor;
window.onNoteLeftAction = onNoteLeftAction;
window.onNoteRightAction = onNoteRightAction;
window.onNoteInputChange = onNoteInputChange;
window.saveMyNote = saveMyNote;
window.loadNotes = loadNotes;
window.handleIncomingNoteUpsert = handleIncomingNoteUpsert;
window.handleIncomingNoteDelete = handleIncomingNoteDelete;

document.addEventListener('DOMContentLoaded', () => {
  renderNotesStrip();
  loadNotes();

  const bubble = document.getElementById('note-fullscreen-bubble');
  if (bubble) {
    bubble.addEventListener('input', () => {
      onNoteInputChange();
    });
  }
});
