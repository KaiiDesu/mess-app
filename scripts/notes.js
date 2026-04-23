const NOTE_MAX_CHARS = 60;
const NOTE_TTL_HOURS = 24;

window.zapNotes = window.zapNotes || [];
window.__zapActiveNoteUserId = null;

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

function openNoteEditor() {
  const editor = document.getElementById('note-fullscreen-editor');
  const actions = document.getElementById('note-fullscreen-actions');
  const input = document.getElementById('note-input');
  const me = getCurrentNotesUserId();
  const note = getNoteByUserId(me);

  if (!editor || !input) return;

  input.value = note?.content || '';
  editor.classList.remove('hidden');
  if (actions) {
    actions.classList.add('hidden');
  }
  onNoteInputChange(input);
  input.focus();
}

function closeNoteEditor() {
  const editor = document.getElementById('note-fullscreen-editor');
  const actions = document.getElementById('note-fullscreen-actions');
  const isMine = window.__zapActiveNoteUserId && window.__zapActiveNoteUserId === getCurrentNotesUserId();

  if (editor) {
    editor.classList.add('hidden');
  }

  if (actions) {
    actions.classList.toggle('hidden', !isMine);
  }
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
  const editor = document.getElementById('note-fullscreen-editor');

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

  if (actions) {
    actions.classList.toggle('hidden', !isMine);
  }
  if (editor) {
    editor.classList.add('hidden');
  }

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
  const input = el || document.getElementById('note-input');
  if (!input) return;

  if (input.value.length > NOTE_MAX_CHARS) {
    input.value = input.value.slice(0, NOTE_MAX_CHARS);
  }

  const count = document.getElementById('note-char-count');
  if (count) {
    count.textContent = `${input.value.length}/${NOTE_MAX_CHARS}`;
  }

  const saveBtn = document.getElementById('note-save-btn');
  if (saveBtn) {
    const text = String(input.value || '').trim();
    saveBtn.disabled = text.length < 1 || text.length > NOTE_MAX_CHARS;
  }
}

function openNoteComposer() {
  openNoteProfile(getCurrentNotesUserId());
}

function closeNoteComposer() {
  setNoteFullscreenVisible(false);
  closeNoteEditor();
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
  const input = document.getElementById('note-input');
  const saveBtn = document.getElementById('note-save-btn');
  if (!input || !saveBtn) return;

  const content = String(input.value || '').trim();
  if (!content || content.length > NOTE_MAX_CHARS) {
    onNoteInputChange(input);
    return;
  }

  const token = getNotesAuthToken();
  if (!token) return;

  saveBtn.disabled = true;

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
      saveBtn.disabled = false;
      return;
    }

    if (payload?.note) {
      upsertNoteInState(payload.note);
      renderNotesStrip();
    }

    closeNoteEditor();
    openNoteProfile(getCurrentNotesUserId());
  } catch (_) {
    // Ignore transient network failures; socket sync or next refresh can reconcile.
  } finally {
    saveBtn.disabled = false;
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
window.onNoteInputChange = onNoteInputChange;
window.saveMyNote = saveMyNote;
window.loadNotes = loadNotes;
window.handleIncomingNoteUpsert = handleIncomingNoteUpsert;
window.handleIncomingNoteDelete = handleIncomingNoteDelete;

document.addEventListener('DOMContentLoaded', () => {
  renderNotesStrip();
  loadNotes();
});
