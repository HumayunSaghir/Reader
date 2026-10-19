// Runs before the app bundle so a saved dark theme applies on first paint.
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
} catch (e) {
  // Storage unavailable (private mode): fall back to the light theme
}
