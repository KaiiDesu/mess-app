const NOTE_MAX_CHARS = 60;
const NOTE_TTL_HOURS = 24;

window.zapNotes = window.zapNotes || [];

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

  const addCard = `
    <div class="note-item add" onclick="openNoteComposer()">
      <div class="note-avatar-wrap"><div class="note-avatar">+</div></div>
      <div class="note-name">Your note</div>
    </div>
  `;

  const mineCard = myNote
    ? `
      <div class="note-item mine" onclick="openNoteComposer()">
        <div class="note-avatar-wrap">
          <div class="note-avatar">${getNoteAvatar(myNote.display_name || myNote.userName || 'You')}</div>
          <div class="note-bubble">${escapeNotesHtml(String(myNote.content || ''))}</div>
        </div>
        <div class="note-name">You</div>
      </div>
    `
    : '';

  const otherCards = others
    .map((note) => {
      const userId = note.user_id || note.userId;
      const displayName = note.display_name || note.userName || 'Friend';
      const content = String(note.content || '').trim();
      return `
        <div class="note-item" data-user-id="${escapeNotesHtml(userId)}">
          <div class="note-avatar-wrap">
            <div class="note-avatar">${getNoteAvatar(displayName)}</div>
            <div class="note-bubble">${escapeNotesHtml(content)}</div>
          </div>
          <div class="note-name">${escapeNotesHtml(displayName)}</div>
        </div>
      `;
    })
    .join('');

  row.innerHTML = `${addCard}${mineCard}${otherCards}`;

  if (!myNote && !others.length) {
    row.innerHTML = `${addCard}<div class="note-empty">No active notes yet.</div>`;
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
  const composer = document.getElementById('note-composer');
  const input = document.getElementById('note-input');
  if (!composer || !input) return;

  const mine = getMineNote();
  input.value = mine?.content || '';
  composer.classList.remove('hidden');
  onNoteInputChange(input);
  input.focus();
}

function closeNoteComposer() {
  const composer = document.getElementById('note-composer');
  if (!composer) return;
  composer.classList.add('hidden');
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

    closeNoteComposer();
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
window.onNoteInputChange = onNoteInputChange;
window.saveMyNote = saveMyNote;
window.loadNotes = loadNotes;
window.handleIncomingNoteUpsert = handleIncomingNoteUpsert;
window.handleIncomingNoteDelete = handleIncomingNoteDelete;

document.addEventListener('DOMContentLoaded', () => {
  renderNotesStrip();
  loadNotes();
});
