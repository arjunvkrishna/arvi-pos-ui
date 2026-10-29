// Runs before the page paints (no flash of the wrong theme). Same storage key as the classic app.
(function () {
  try {
    var saved = localStorage.getItem('arvi_theme');
    var dark = saved ? saved !== 'light' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) { /* ignore */ }
})();
