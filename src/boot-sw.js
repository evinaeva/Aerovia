/* ===== PWA: регистрация service worker =====
 * SW даёт офлайн-старт; контент обновляется автоматически (navigation
 * грузится network-first). Когда меняется сам sw.js (VERSION), новый воркер
 * активируется через skipWaiting и перезагружает страницу через controllerchange. */
(() => {
  if (!('serviceWorker' in navigator)) return;
  const swUrl = new URL('sw.js', location.href).href;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; reloading = true; location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).then((reg) => {
      // долго открытая вкладка / установленное приложение — периодически проверяем деплой
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => { /* нет https / приватный режим — игра работает и без SW */ });
  });
})();
