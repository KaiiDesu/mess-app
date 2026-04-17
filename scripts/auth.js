function getApiBaseUrl() {
  return window.ZAP_API_URL || 'http://localhost:3000';
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

function clearAuthSession() {
  localStorage.removeItem('zap_jwt');
  localStorage.removeItem('zap_user');
  localStorage.removeItem('token');
  sessionStorage.removeItem('zap_jwt');
  sessionStorage.removeItem('zap_user');
  sessionStorage.removeItem('token');
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

  if (typeof window.ensureSystemNotificationPermission === 'function') {
    window.ensureSystemNotificationPermission();
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  navigate('view-home');
}

async function loginAccount() {
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

  if (typeof window.ensureSystemNotificationPermission === 'function') {
    window.ensureSystemNotificationPermission();
  }

  if (typeof hydrateProfileHeader === 'function') {
    hydrateProfileHeader();
  }

  navigate('view-home');
}

window.registerAccount = registerAccount;
window.loginAccount = loginAccount;

function getCurrentSessionUser() {
  return getStoredSessionUser();
}

function signOut() {
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

  // Auto-restore remembered login when app restarts on this device.
  const token = getStoredAuthToken();
  if (token && currentView === 'view-login') {
    navigate('view-home');
  }
});
