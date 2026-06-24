// ===== 12d-consent — GDPR consent banner + Android install-referrer attribution =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: ConsentBanner.
// Reads: Analytics (07).

  const ConsentBanner = (() => {
    const KEY     = 'pf_consent_v1';   // '1' accepted · '0' declined · null = not asked yet
    const REF_KEY = 'pf_referrer_v1';  // install referrer; captured once on first accepted run

    function stored(): boolean | null {
      const v = localStorage.getItem(KEY);
      return v === null ? null : v === '1';
    }

    function apply(accepted: boolean): void {
      localStorage.setItem(KEY, accepted ? '1' : '0');
      Analytics.setConsent(accepted);
    }

    // Read Android Install Referrer (native only) and emit an attribution event.
    // No-op on web/PWA or if already captured.
    function captureReferrer(): void {
      const cap: any = (window as any).Capacitor;
      if (!cap?.Plugins?.InstallReferrer) return;
      if (localStorage.getItem(REF_KEY)) return;
      cap.Plugins.InstallReferrer.get()
        .then((r: any) => {
          const ref = (r && r.referrer) ? String(r.referrer) : 'organic';
          localStorage.setItem(REF_KEY, ref);
          Analytics.track('attribution', { install_referrer: ref });
        })
        .catch(() => { localStorage.setItem(REF_KEY, 'unknown'); });
    }

    function show(): void {
      const el = document.createElement('div');
      el.id = 'consent-overlay';
      el.className = 'overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML =
        '<div class="panel consent-panel">' +
          '<p class="consent-title">' + t('consent.title') + '</p>' +
          '<p class="consent-body">' +
            t('consent.body1') + '<br>' +
            t('consent.body2') +
          '</p>' +
          '<p class="consent-privacy">' +
            '<a href="privacy.html" target="_blank" rel="noopener">' + t('consent.privacy') + '</a>' +
          '</p>' +
          '<div class="consent-btns">' +
            '<button id="consent-no"  class="m-btn m-btn--ghost">' + t('consent.no') + '</button>' +
            '<button id="consent-yes" class="m-btn m-btn--primary">' + t('consent.yes') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);

      (el.querySelector('#consent-yes') as HTMLButtonElement).addEventListener('click', () => {
        el.remove(); apply(true); captureReferrer();
      }, { once: true });
      (el.querySelector('#consent-no') as HTMLButtonElement).addEventListener('click', () => {
        el.remove(); apply(false);
      }, { once: true });
    }

    function init(): void {
      const v = stored();
      if (v === true)  { Analytics.setConsent(true); captureReferrer(); return; }
      if (v === false) { return; }   // already declined; consent stays false
      // First run — show banner; consent stays false until user accepts
      show();
    }

    return { init, hasConsent: () => stored() };
  })();
