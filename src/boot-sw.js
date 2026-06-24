/* ===== PWA: регистрация service worker + тост обновления =====
 * SW даёт офлайн-старт; контент по-прежнему обновляется мгновенно (navigation
 * грузится network-first). Когда меняется сам sw.js (VERSION), новый воркер
 * встаёт в ожидание, мы показываем тост, и по нажатию делаем skipWaiting +
 * единоразовый reload через событие controllerchange. */
(() => {
  if (!('serviceWorker' in navigator)) {
    // Без service worker нельзя определить, есть ли обновление — считаем актуальным.
    // Перезагрузку делает pwaApplyUpdate по явному запросу пользователя.
    window.pwaCheckForUpdateAvailable = () => Promise.resolve('up-to-date');
    window.pwaApplyUpdate = () => location.reload();
    window.pwaCheckForUpdates = () => { location.reload(); return Promise.resolve('updating'); };
    return;
  }
  const swUrl = new URL('sw.js', location.href).href; // относительно подпапки (GitHub Pages)
  let swReg = null;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; reloading = true; location.reload();
  });

  function showUpdate(worker) {
    const t = document.getElementById('pwaUpdate'); if (!t || !worker) return;
    t.classList.add('show');
    const btn = document.getElementById('pwaUpdateBtn');
    btn.onclick = () => { t.classList.remove('show'); worker.postMessage('SKIP_WAITING'); };
  }

  // Проверка обновлений по запросу (кнопка в настройках). Возвращает Promise со
  // строкой-статусом: 'updating' — нашли новую версию приложения, она сама
  // применится и перезагрузит страницу (sw.js делает skipWaiting на install);
  // 'refreshed' — версия актуальна, перекачали закэшированные ресурсы/PNG скинов
  // и перезагружаемся; 'offline' — проверка не удалась (нет сети).
  // Только проверяет наличие обновления, не применяет. Возвращает 'available' /
  // 'up-to-date' / 'offline'. Вызывается по кнопке «Проверить обновления».
  window.pwaCheckForUpdateAvailable = async () => {
    if (!swReg) return 'offline';
    try { await swReg.update(); } catch { return 'offline'; }
    return (swReg.installing || swReg.waiting) ? 'available' : 'up-to-date';
  };

  // Применяет уже найденное обновление (отправляет SKIP_WAITING waiting-воркеру).
  // Страница перезагрузится сама через controllerchange.
  window.pwaApplyUpdate = () => {
    if (!swReg) { location.reload(); return; }
    if (swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING');
  };

  window.pwaCheckForUpdates = async () => {
    if (!swReg) { location.reload(); return 'updating'; }
    try { await swReg.update(); } catch { return 'offline'; }

    // Если появился новый воркер — это апдейт приложения. sw.js на install
    // вызывает skipWaiting()+clients.claim(), так что controllerchange сам
    // перезагрузит страницу; на всякий случай подталкиваем waiting-воркер.
    const incoming = swReg.installing || swReg.waiting;
    if (incoming) {
      const nudge = () => { if (swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); };
      if (incoming.state === 'installed') nudge();
      else incoming.addEventListener('statechange', () => { if (incoming.state === 'installed') nudge(); });
      return 'updating';
    }

    // Shell актуален — версия приложения не изменилась.
    return 'refreshed';
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).then((reg) => {
      swReg = reg;
      // обновление уже скачалось, пока вкладка была закрыта
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', () => {
          // controller != null → это апдейт, а не первая установка
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
        });
      });
      // долго открытая вкладка/установленное приложение — периодически проверяем деплой
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => { /* нет https / приватный режим — игра работает и без SW */ });
  });
})();
