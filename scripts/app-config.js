(function bootstrapRuntimeApiConfig() {
  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  var query = new URLSearchParams(window.location.search || '');
  var apiFromQuery = normalizeBaseUrl(query.get('api'));
  var apiFromStorage = normalizeBaseUrl(localStorage.getItem('zap_api_url'));
  var apiFromMobileConfig = normalizeBaseUrl(window.ZAP_MOBILE_API_URL);

  var resolvedApiBase =
    apiFromQuery || apiFromMobileConfig || apiFromStorage || window.ZAP_API_URL || 'http://localhost:3000';

  // Persist query-provided API endpoint so users only need to pass it once.
  if (apiFromQuery) {
    localStorage.setItem('zap_api_url', resolvedApiBase);
  } else if (apiFromMobileConfig && apiFromStorage !== apiFromMobileConfig) {
    // Keep runtime storage aligned with mobile builds to avoid stale localhost overrides.
    localStorage.setItem('zap_api_url', apiFromMobileConfig);
  }

  window.ZAP_API_URL = normalizeBaseUrl(resolvedApiBase);
  window.ZAP_SOCKET_URL = normalizeBaseUrl(window.ZAP_SOCKET_URL || window.ZAP_API_URL);
})();
