window.ZapTemplateParts = window.ZapTemplateParts || {};
window.ZapTemplateParts.mainViews = String.raw`
<!-- ==================== HOME SCREEN ==================== -->
    <div class="view hidden" id="view-home">
      <div class="status-bar"><span>9:41</span><div class="status-icons"><svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;stroke:var(--text2);stroke-width:2;stroke-linecap:round"><path d="M1 6l4.5 4.5L12 4l6.5 6.5L23 6"/></svg><svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;stroke:var(--text2);stroke-width:2;stroke-linecap:round"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg><svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;stroke:var(--text2);stroke-width:2"><rect x="2" y="7" width="18" height="11" rx="2"/><path d="M22 11v2"/></svg></div></div>

      <div class="home-header">
        <div class="home-title">Chats</div>
        <div class="header-actions">
          <div class="icon-btn" onclick="openModal()"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg></div>
        </div>
      </div>

      <div class="connection-check hidden" id="home-connection-check">Checking internet connection...</div>

      <div class="search-bar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search conversations..." oninput="filterChats(this.value)">
      </div>

      <div class="notes-strip" id="notes-strip">
        <div class="notes-strip-head">
          <div class="notes-strip-title">Notes</div>
          <button class="notes-add-btn" type="button" onclick="openNoteComposer()">Add note</button>
        </div>
        <div class="notes-row" id="notes-row"></div>
        <div class="note-composer hidden" id="note-composer">
          <input
            type="text"
            id="note-input"
            class="note-input"
            maxlength="60"
            placeholder="Share a quick note..."
            oninput="onNoteInputChange(this)"
          >
          <div class="note-composer-meta">
            <span id="note-char-count">0/60</span>
            <div class="note-composer-actions">
              <button class="note-btn ghost" type="button" onclick="closeNoteComposer()">Cancel</button>
              <button class="note-btn" type="button" id="note-save-btn" onclick="saveMyNote()">Post</button>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-list" id="chat-list">
        <div class="chat-loading-wrap" aria-live="polite" aria-busy="true">
          <div class="chat-loading-item"></div>
          <div class="chat-loading-item"></div>
          <div class="chat-loading-item"></div>
        </div>
      </div>

      

      <!-- BOTTOM NAV -->
      <div class="bottom-nav">
        <div class="nav-item active" onclick="switchTab(this,'view-home')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="nav-label">Chats</span><div class="nav-dot"></div></div>
        <div class="nav-item" onclick="switchTab(this,'view-friends')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="nav-label">Friends</span></div>
        <div class="nav-item" onclick="switchTab(this,'view-profile')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="nav-label">Profile</span></div>
      </div>
    </div>

    <!-- ==================== CHAT SCREEN ==================== -->
    <div class="view hidden" id="view-chat">
      <div class="status-bar" style="background:var(--bg)"><span>9:41</span></div>
      <div class="chat-header">
        <button class="back-btn" onclick="navigate('view-home')"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="avatar" id="chat-av" style="width:40px;height:40px;font-size:18px;background:var(--bg4);border:none">😄</div>
        <div class="chat-header-info">
          <button class="chat-header-name-btn" id="chat-name-btn" onclick="openConversationSettings()">
            <span class="chat-header-name" id="chat-name">Alex Rivera</span>
          </button>
          <div class="chat-header-status" id="chat-status">● Active now</div>
          <div class="connection-check connection-check-inline hidden" id="chat-connection-check">Checking internet connection...</div>
        </div>
        <div class="chat-header-actions">
          <div class="icon-btn" onclick="openThemePicker()"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg></div>
          <div class="icon-btn"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
        </div>
      </div>

      <button class="new-message-jump-pill hidden" id="new-message-jump-pill" onclick="jumpToLatestIncomingMessage()" type="button" aria-label="Jump to latest unseen message"></button>

      <button class="scroll-bottom-bubble hidden" id="scroll-bottom-bubble" onclick="jumpToConversationBottom()" type="button" aria-label="Jump to bottom">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 10 12 16 18 10"></polyline></svg>
      </button>

      <div class="messages" id="messages-container">
        <div class="enc-badge"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Messages are end-to-end encrypted</span></div>
        <div class="conversation-loading-wrap" aria-live="polite" aria-busy="true">
          <div class="conversation-loading-row"></div>
          <div class="conversation-loading-row"></div>
          <div class="conversation-loading-row"></div>
        </div>
      </div>

      <!-- REACTION PICKER -->
      <div class="reaction-picker" id="reaction-picker">
        <div class="reaction-emoji" onclick="addReaction('❤️')">❤️</div>
        <div class="reaction-emoji" onclick="addReaction('😂')">😂</div>
        <div class="reaction-emoji" onclick="addReaction('😮')">😮</div>
        <div class="reaction-emoji" onclick="addReaction('😢')">😢</div>
        <div class="reaction-emoji" onclick="addReaction('👍')">👍</div>
        <div class="reaction-emoji" onclick="addReaction('🔥')">🔥</div>
      </div>

      <div class="message-action-backdrop" id="message-action-backdrop" onclick="hideMessageActionSheet(); hideReactionPicker()"></div>
      <div class="message-action-sheet" id="message-action-sheet">
        <button class="message-action-btn" type="button" onclick="copySelectedMessageText()">Copy</button>
        <button class="message-action-btn danger" type="button" onclick="deleteSelectedMessage()">Delete</button>
      </div>

      <div class="reply-preview-bar hidden" id="reply-preview-bar"></div>
      <div class="paste-preview-bar hidden" id="paste-preview-bar"></div>

      <!-- INPUT BAR -->
      <div class="input-bar" id="input-bar">
        <button class="input-icon-btn" onclick="triggerMediaPicker()"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
        <div class="msg-input-wrap">
          <textarea class="msg-input" id="msg-input" rows="1" placeholder="Message..." oninput="onInputChange(this)"></textarea>
          <button class="input-icon-btn"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>
        </div>
        <button class="voice-btn" id="voice-btn" onmousedown="startRecording()" onmouseup="stopRecording()" ontouchstart="startRecording(event)" ontouchend="stopRecording()"><svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>
        <button class="send-btn" id="send-btn" style="display:none" onclick="sendMessage()"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>

      <!-- RECORDING BAR -->
      <div class="recording-bar" id="recording-bar">
        <div class="rec-dot"></div>
        <div class="rec-timer" id="rec-timer">0:00</div>
        <div class="rec-waveform" id="rec-waveform"></div>
        <div class="rec-cancel" onclick="cancelRecording()">✕ Cancel</div>
        <div class="rec-lock" onclick="lockRecording()">
          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Lock</span>
        </div>
      </div>
    </div>

    <!-- ==================== FRIENDS SCREEN ==================== -->
    <div class="view hidden" id="view-friends">
      <div class="status-bar"><span>9:41</span></div>
      <div class="friends-header">
        <div class="friends-title">Friends</div>
        <div class="friends-sub">Manage your connections</div>
      </div>
      <div class="search-bar" style="margin:0 20px 14px">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--text3);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search friends..." style="background:none;border:none;outline:none;font-family:var(--font);font-size:14px;color:var(--text);flex:1">
      </div>
      <div class="scrollable" style="padding-bottom:80px">
        <div class="section-label" id="friend-requests-label">Requests (0)</div>
        <div id="friend-requests-list"></div>
        <div class="section-label" id="friends-count-label">Your Friends (0)</div>
        <div id="friends-list"></div>
        <div style="padding:20px;display:flex;justify-content:center">
          <button class="btn-ghost" onclick="openModal()" style="display:flex;align-items:center;gap:8px;padding:12px 24px">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--text2);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add a new friend
          </button>
        </div>
      </div>
      <div class="bottom-nav">
        <div class="nav-item" onclick="switchTab(this,'view-home')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="nav-label">Chats</span></div>
        <div class="nav-item active"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="nav-label">Friends</span></div>
        <div class="nav-item" onclick="switchTab(this,'view-profile')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="nav-label">Profile</span></div>
      </div>
    </div>

    <!-- ==================== PROFILE SCREEN ==================== -->
    <div class="view hidden" id="view-profile">
      <div class="status-bar"><span>9:41</span></div>
      <div class="scrollable" style="padding-bottom:80px">
        <div class="profile-hero">
          <div class="profile-avatar" id="profile-avatar">😄<div class="profile-edit-badge"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div></div>
          <div class="profile-name" id="profile-name">You</div>
          <div class="profile-username" id="profile-username">@yourhandle</div>
        </div>

        <div style="height:1px;background:var(--border2);margin:0 20px"></div>

        <div class="settings-section">
          <div class="section-label">Account</div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#7c6bff"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div class="settings-text"><div class="settings-label">Edit Profile</div><div class="settings-desc">Name, photo, bio</div></div>
            <svg class="settings-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#34d399"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div class="settings-text"><div class="settings-label">Privacy & Security</div><div class="settings-desc">E2E encryption, blocked users</div></div>
            <svg class="settings-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#f472b6"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div class="settings-text"><div class="settings-label">Notifications</div><div class="settings-desc">Customize alerts</div></div>
            <div class="toggle on" onclick="this.classList.toggle('on')"></div>
          </div>
        </div>

        <div style="height:1px;background:var(--border2);margin:0 20px"></div>

        <div class="settings-section">
          <div class="section-label">Preferences</div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#fbbf24"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
            <div class="settings-text"><div class="settings-label">Appearance</div><div class="settings-desc">Theme, font size</div></div>
            <svg class="settings-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#3b82f6"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div class="settings-text"><div class="settings-label">Chat Backup</div><div class="settings-desc">iCloud / Google Drive</div></div>
            <svg class="settings-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="settings-item">
            <div class="settings-icon" style="background:#8b5cf6"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
            <div class="settings-text"><div class="settings-label">Data & Storage</div><div class="settings-desc">Media auto-download</div></div>
            <div class="toggle" onclick="this.classList.toggle('on')"></div>
          </div>
        </div>

        <div style="padding:20px;display:flex;flex-direction:column;gap:10px">
          <button class="btn-ghost" style="color:var(--red);border-color:rgba(248,113,113,0.3)" onclick="signOut()">Sign Out</button>
        </div>
      </div>

      <div class="bottom-nav">
        <div class="nav-item" onclick="switchTab(this,'view-home')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="nav-label">Chats</span></div>
        <div class="nav-item" onclick="switchTab(this,'view-friends')"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="nav-label">Friends</span></div>
        <div class="nav-item active"><svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="nav-label">Profile</span></div>
      </div>
    </div>
`;
