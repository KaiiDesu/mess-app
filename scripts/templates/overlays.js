window.ZapTemplateParts = window.ZapTemplateParts || {};
window.ZapTemplateParts.overlays = String.raw`
    <!-- ==================== SERVER DOWN OVERLAY ==================== -->
    <div class="server-down-overlay" id="server-down-overlay" aria-live="assertive" aria-hidden="true">
      <div class="server-down-card">
        <div class="server-down-title">Server down</div>
        <div class="server-down-text">Service is temporarily unavailable. Please try again in a few minutes.</div>
      </div>
    </div>

<!-- ==================== ADD FRIEND MODAL ==================== -->
    <div class="modal" id="add-friend-modal" onclick="closeModal(event)">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Add Friend</div>
        <div class="modal-sub">Search by display name, username, or email</div>
        <div class="search-bar" style="margin:0 0 16px">
          <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--text3);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="friend-search-input" type="text" placeholder="@username or phone..." style="background:none;border:none;outline:none;font-family:var(--font);font-size:14px;color:var(--text);flex:1">
        </div>
        <div id="friend-search-results">
          <div style="padding:12px 4px;font-size:12px;color:var(--text3)">Type at least 2 characters to search.</div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px">
          <button class="btn-ghost" style="flex:1" onclick="closeAddFriendModal()">Cancel</button>
          <button class="btn-primary" style="flex:1" onclick="closeAddFriendModal()">Done</button>
        </div>
      </div>
    </div>

    <!-- ==================== THEME PICKER ==================== -->
    <div class="theme-modal" id="theme-modal" onclick="closeThemeModal(event)">
      <div class="theme-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Chat Theme</div>
        <div class="modal-sub">Personalize your conversation</div>
        <div class="theme-grid" id="theme-grid">
          <div class="theme-option active" style="background:linear-gradient(135deg,#7c6bff,#a78bfa)" onclick="selectTheme(this,'purple','linear-gradient(135deg,#7c6bff,#a78bfa)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#f472b6,#ec4899)" onclick="selectTheme(this,'pink','linear-gradient(135deg,#f472b6,#ec4899)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#34d399,#10b981)" onclick="selectTheme(this,'green','linear-gradient(135deg,#34d399,#10b981)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#f59e0b,#f97316)" onclick="selectTheme(this,'orange','linear-gradient(135deg,#f59e0b,#f97316)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#3b82f6,#06b6d4)" onclick="selectTheme(this,'blue','linear-gradient(135deg,#3b82f6,#06b6d4)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#ef4444,#f97316)" onclick="selectTheme(this,'red','linear-gradient(135deg,#ef4444,#f97316)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#8b5cf6,#d946ef)" onclick="selectTheme(this,'violet','linear-gradient(135deg,#8b5cf6,#d946ef)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#0ea5e9,#8b5cf6)" onclick="selectTheme(this,'sky','linear-gradient(135deg,#0ea5e9,#8b5cf6)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#fbbf24,#34d399)" onclick="selectTheme(this,'gold','linear-gradient(135deg,#fbbf24,#34d399)')"></div>
          <div class="theme-option" style="background:linear-gradient(135deg,#6b7280,#374151)" onclick="selectTheme(this,'dark','linear-gradient(135deg,#6b7280,#374151)')"></div>
        </div>
        <div style="margin-top:20px">
          <button class="btn-primary" onclick="applyConversationTheme()" style="width:100%">Apply Theme</button>
        </div>
      </div>
    </div>

    <!-- ==================== CONVERSATION SETTINGS ==================== -->
    <div class="modal" id="conversation-settings-modal" onclick="closeConversationSettings(event)">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">Conversation Settings</div>
        <div class="modal-sub">Profile and chat preferences</div>

        <div class="conv-settings-profile">
          <div class="avatar" id="conv-settings-avatar" style="width:56px;height:56px;font-size:22px;background:var(--bg4);border:none">🙂</div>
          <div class="conv-settings-profile-text">
            <div class="conv-settings-name" id="conv-settings-name">User</div>
            <div class="conv-settings-username" id="conv-settings-username">@username</div>
            <div class="conv-settings-status" id="conv-settings-status">Offline</div>
          </div>
        </div>

        <div class="conv-settings-actions">
          <button class="btn-ghost conv-settings-btn" onclick="openConversationThemeFromSettings()">Change Theme</button>
          <button class="btn-ghost conv-settings-btn" onclick="changeConversationNickname()">Change Nickname</button>
          <button class="btn-ghost conv-settings-btn danger" onclick="deleteCurrentConversation()">Delete Conversation</button>
        </div>

        <div style="margin-top:14px;display:flex;gap:10px">
          <button class="btn-primary" style="flex:1" onclick="closeConversationSettings()">Done</button>
        </div>
      </div>
    </div>

    <!-- MEDIA PREVIEW -->
    <div class="media-modal" id="media-modal">
      <div class="media-close" onclick="document.getElementById('media-modal').classList.remove('open')"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2.5;stroke-linecap:round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='260' viewBox='0 0 360 260'%3E%3Crect width='360' height='260' fill='%23252535'/%3E%3Ccircle cx='180' cy='130' r='80' fill='%237c6bff22' stroke='%237c6bff' stroke-width='2'/%3E%3Ctext x='180' y='148' font-size='72' text-anchor='middle'%3E🏀%3C/text%3E%3C/svg%3E">
      <div style="position:absolute;bottom:40px;display:flex;gap:20px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer"><svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span style="font-size:11px;color:rgba(255,255,255,0.7)">Save</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer"><svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span style="font-size:11px;color:rgba(255,255,255,0.7)">Share</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer"><svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:var(--red);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg><span style="font-size:11px;color:rgba(248,113,113,0.9)">Delete</span></div>
      </div>
    </div>
`;
