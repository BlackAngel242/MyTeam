// Chargé avant le CSS : la préférence s'applique sans flash de thème.
(() => {
  'use strict';
  const key = 'myteam.appearance';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark'].includes(value) ? value : 'system';
  let stored;
  try { stored = localStorage.getItem(key); } catch {}
  let preference = valid(stored);
  function apply() {
    root.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.dataset.appearance = preference;
    document.querySelectorAll('[data-appearance-select]').forEach(select => select.value = preference);
  }
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue);
    apply();
  });
  function bind() {
    document.querySelectorAll('[data-appearance-select]').forEach(select => {
      select.value = preference;
      select.addEventListener('change', () => {
        preference = valid(select.value);
        try { localStorage.setItem(key, preference); } catch {}
        apply();
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
