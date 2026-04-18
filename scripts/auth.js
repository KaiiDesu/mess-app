function getApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
}

let serverDownRetryTimer = null;
let serverDownRetryInFlight = false;
let serverDownRetryAttempt = 0;

function showServerRecoveryNotice() {
  const message = 'You were automatically logged out by session. The server is back online.';

  if (typeof window.showInAppNotificationToast === 'function') {
    window.showInAppNotificationToast({
      senderName: 'Zap',
      messageText: message
    });
    return;
  }

  window.alert(message);
}

function stopServerDownAutoRetry() {
  if (!serverDownRetryTimer) return;
  clearTimeout(serverDownRetryTimer);
  serverDownRetryTimer = null;
  serverDownRetryAttempt = 0;
}

async function pingServerHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    return response.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function handleServerRecovered() {
  const noticePending = sessionStorage.getItem('zap_server_down_notice_pending') === '1';
  sessionStorage.removeItem('zap_server_down_notice_pending');
  setServerDownOverlayVisible(false);

  if (noticePending) {
    showServerRecoveryNotice();
  }

  if (currentView === 'view-login') {
    bootstrapSessionOnLaunch();
  }
}

function getServerDownRetryDelayMs(attempt) {
  // 1s, 2s, 4s, 8s, then cap at 12s
  const base = Math.min(12000, 1000 * Math.pow(2, Math.max(0, attempt)));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function scheduleServerDownRetry(delayMs) {
  if (serverDownRetryTimer) {
    clearTimeout(serverDownRetryTimer);
  }

  serverDownRetryTimer = setTimeout(() => {
    runServerDownRetryProbe();
  }, Math.max(0, delayMs));
}

async function runServerDownRetryProbe() {
  if (serverDownRetryInFlight) {
    scheduleServerDownRetry(500);
    return;
  }

  serverDownRetryInFlight = true;
  try {
    const reachable = await pingServerHealth();
    if (reachable) {
      handleServerRecovered();
      return;
    }

    serverDownRetryAttempt += 1;
    scheduleServerDownRetry(getServerDownRetryDelayMs(serverDownRetryAttempt));
  } finally {
    serverDownRetryInFlight = false;
  }
}

function startServerDownAutoRetry() {
  if (serverDownRetryTimer || serverDownRetryInFlight) return;

  // Immediate first retry attempt; no fixed 15s wait.
  scheduleServerDownRetry(0);
}

function setServerDownOverlayVisible(isVisible) {
  if (!isVisible) {
    stopServerDownAutoRetry();
  }

  const overlay = document.getElementById('server-down-overlay');
  if (!overlay) {
    if (isVisible) {
      startServerDownAutoRetry();
    }
    return;
  }

  overlay.classList.toggle('show', Boolean(isVisible));
  overlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');

  if (isVisible) {
    startServerDownAutoRetry();
  }
}

function isServerDownResponse(response) {
  if (!response) return true;
  return response.status >= 500 || response.status === 0;
}

async function checkServerAvailability(token) {
  const healthReachable = await pingServerHealth();
  if (!healthReachable) {
    return { reachable: false, unauthorized: false };
  }

  if (!token) {
    return { reachable: true, unauthorized: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    if (isServerDownResponse(response)) {
      return { reachable: false, unauthorized: false };
    }

    if (response.status === 401 || response.status === 403) {
      return { reachable: true, unauthorized: true };
    }

    return { reachable: true, unauthorized: false };
  } catch (_) {
    return { reachable: false, unauthorized: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function bootstrapSessionOnLaunch() {
  const token = getStoredAuthToken();
  if (!token || currentView !== 'view-login') {
    setServerDownOverlayVisible(false);
    return;
  }

  const serverState = await checkServerAvailability(token);

  if (!serverState.reachable) {
    sessionStorage.setItem('zap_server_down_notice_pending', '1');
    clearAuthSession({ preserveRememberedSession: true });
    if (window.appSocket) {
      window.appSocket.disconnect();
    }
    navigate('view-login');
    setServerDownOverlayVisible(true);
    return;
  }

  if (serverState.unauthorized) {
    clearAuthSession();
    navigate('view-login');
    setServerDownOverlayVisible(false);
    return;
  }

  setServerDownOverlayVisible(false);
  navigate('view-home');
}

function getStoredAuthToken() {
  return (
    localStorage.getItem('zap_jwt') ||
    sessionStorage.getItem('zap_jwt') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}

function getStoredSessionUser() {
  const raw = localStorage.getItem('zap_user') || sessionStorage.getItem('zap_user') || 'null';
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveAuthSession(token, user, rememberMe) {
  if (!token) return;

  const userJson = JSON.stringify(user || {});

  localStorage.removeItem('zap_jwt');
  localStorage.removeItem('zap_user');
  sessionStorage.removeItem('zap_jwt');
  sessionStorage.removeItem('zap_user');

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('zap_jwt', token);
  storage.setItem('zap_user', userJson);

  localStorage.setItem('zap_remember_me', rememberMe ? '1' : '0');
}

function clearAuthSession(options = {}) {
  const preserveRememberedSession = Boolean(options?.preserveRememberedSession && readRememberPreference());

  if (!preserveRememberedSession) {
    localStorage.removeItem('zap_jwt');
    localStorage.removeItem('zap_user');
    localStorage.removeItem('token');
  }

  sessionStorage.removeItem('zap_jwt');
  sessionStorage.removeItem('zap_user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('zap_server_down_notice_pending');
}

function readRememberPreference() {
  return localStorage.getItem('zap_remember_me') !== '0';
}

function getAuthValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

function setAuthError(message) {
  console.error('[auth]', message);
  window.alert(message);
}

function sanitizeHandle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '_');
}

function getDisplayNameFromUser(user) {
  return user?.displayName || user?.display_name || 'You';
}

function getUsernameFromUser(user) {
  const direct = user?.username || user?.handle;
  if (direct) return sanitizeHandle(direct);

  const emailLocal = String(user?.email || '').split('@')[0];
  if (emailLocal) return sanitizeHandle(emailLocal);

  return 'user';
}

function getAvatarInitial(user) {
  const source = getDisplayNameFromUser(user);
  const first = String(source || '').trim().charAt(0).toUpperCase();
  return first || '🙂';
}

function applyProfileHeaderFromUser(user) {
  const nameEl = document.getElementById('profile-name');
  const usernameEl = document.getElementById('profile-username');
  const avatarEl = document.getElementById('profile-avatar');

  if (nameEl) {
    nameEl.textContent = getDisplayNameFromUser(user);
  }

  if (usernameEl) {
    usernameEl.textContent = `@${getUsernameFromUser(user)}`;
  }

  if (avatarEl) {
    avatarEl.childNodes[0].textContent = getAvatarInitial(user);
  }
}

async function hydrateProfileHeader() {
  const user = getCurrentSessionUser();
  applyProfileHeaderFromUser(user || {});

  const token = getStoredAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json();
    if (!response.ok) return;

    const mergedUser = {
      ...(user || {}),
      id: payload.id,
      email: payload.email,
      username: payload.username || user?.username,
      displayName: payload.display_name || user?.displayName,
      avatarUrl: payload.avatar_url || user?.avatarUrl
    };

    const rememberMe = readRememberPreference();
    saveAuthSession(token, mergedUser, rememberMe);
    applyProfileHeaderFromUser(mergedUser);
  } catch (_) {
    // Keep local header data when network fetch fails.
  }
}

async function registerAccount() {
  setServerDownOverlayVisible(false);

  if (typeof window.ensureSystemNotificationPermissionWithFeedback === 'function') {
    window.ensureSystemNotificationPermissionWithFeedback();
  } else if (typeof window.ensureSystemNotificationPermission === 'function') {
    window.ensureSystemNotificationPermission();
  }

  const displayName = getAuthValue('register-name');
  const username = getAuthValue('register-username');
  const phone = getAuthValue('register-phone');
  const email = getAuthValue('register-email');
  const password = getAuthValue('register-pass');

  if (!displayName || !email || !password) {
    setAuthError('Full name, email, and password are required.');
    return;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      email,
      password,
      username,
      phone
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    setAuthError(payload.message || 'Registration failed');
    return;
  }

  saveAuthSession(payload.token, payload.user, true);

  if (typeof connectSocketWithToken === 'function') {
    connectSocketWithToken(payload.token);
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  navigate('view-home');

  if (typeof loadConversations === 'function') {
    loadConversations();
  }
  if (typeof loadPendingFriendRequests === 'function') {
    loadPendingFriendRequests();
  }
  if (typeof loadAcceptedFriends === 'function') {
    loadAcceptedFriends();
  }
}

async function loginAccount() {
  setServerDownOverlayVisible(false);

  if (typeof window.ensureSystemNotificationPermissionWithFeedback === 'function') {
    window.ensureSystemNotificationPermissionWithFeedback();
  } else if (typeof window.ensureSystemNotificationPermission === 'function') {
    window.ensureSystemNotificationPermission();
  }

  const email = getAuthValue('login-email');
  const password = getAuthValue('login-pass');
  const rememberMe = Boolean(document.getElementById('login-remember')?.checked);

  if (!email || !password) {
    setAuthError('Email and password are required.');
    return;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const payload = await response.json();

  if (!response.ok) {
    setAuthError(payload.message || 'Login failed');
    return;
  }

  saveAuthSession(payload.token, payload.user, rememberMe);

  if (typeof connectSocketWithToken === 'function') {
    connectSocketWithToken(payload.token);
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  navigate('view-home');

  if (typeof loadConversations === 'function') {
    loadConversations();
  }
  if (typeof loadPendingFriendRequests === 'function') {
    loadPendingFriendRequests();
  }
  if (typeof loadAcceptedFriends === 'function') {
    loadAcceptedFriends();
  }
}

window.registerAccount = registerAccount;
window.loginAccount = loginAccount;

function getCurrentSessionUser() {
  return getStoredSessionUser();
}

function signOut() {
  sessionStorage.removeItem('zap_server_down_notice_pending');
  clearAuthSession();

  if (window.appSocket) {
    window.appSocket.disconnect();
  }

  navigate('view-login');
}

window.getCurrentSessionUser = getCurrentSessionUser;
window.signOut = signOut;
window.hydrateProfileHeader = hydrateProfileHeader;
window.getStoredAuthToken = getStoredAuthToken;
window.saveAuthSession = saveAuthSession;
window.getStoredSessionUser = getStoredSessionUser;
window.clearAuthSession = clearAuthSession;
window.readRememberPreference = readRememberPreference;

document.addEventListener('DOMContentLoaded', () => {
  const rememberToggle = document.getElementById('login-remember');
  if (rememberToggle) {
    rememberToggle.checked = readRememberPreference();
  }

  const nudgeServerRecoveryCheck = () => {
    const overlay = document.getElementById('server-down-overlay');
    if (overlay?.classList.contains('show')) {
      stopServerDownAutoRetry();
      startServerDownAutoRetry();
    }
  };

  window.addEventListener('online', nudgeServerRecoveryCheck);
  window.addEventListener('focus', nudgeServerRecoveryCheck);

  bootstrapSessionOnLaunch();
});
