(function renderScreen() {
  const root = document.getElementById('screen-root');
  if (!root || !window.ZapTemplateParts) return;
  root.innerHTML = [
    window.ZapTemplateParts.toast || '',
    window.ZapTemplateParts.authViews || '',
    window.ZapTemplateParts.mainViews || '',
    window.ZapTemplateParts.overlays || ''
  ].join('\n\n');
})();