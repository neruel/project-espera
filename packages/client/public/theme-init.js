// Applies the saved theme before first paint. Kept external so the CSP can stay script-src 'self'.
(function () {
  var preference = 'system';
  try { preference = localStorage.getItem('espera_theme') || 'system'; } catch (_) { /* storage unavailable */ }
  var dark = preference === 'dark' || (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
