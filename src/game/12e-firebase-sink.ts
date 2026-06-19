// ===== 12e-firebase-sink — Firebase Analytics sink (native Android) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: (side-effect only — swaps Analytics.sink to native FirebaseAnalyticsPlugin if available)
// Reads: Analytics (07).
// On web/PWA: no-op; console sink from 07 stays active.

  (() => {
    const FA: any = (window as any).Capacitor?.Plugins?.FirebaseAnalytics;
    if (!FA || typeof FA.logEvent !== 'function') return;

    // Firebase name rules: ≤40 chars, [a-zA-Z0-9_]. Values: string ≤100 chars or number.
    function safeName(s: string): string {
      return String(s).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) || '_';
    }

    // Skip ctxBase fields that are noisy as per-event params (screenW/H, seq, ts, etc.).
    const SKIP = new Set(['event', '_sent', 'userId', 'sessionId', 'seq', 'ts', 'screenW', 'screenH']);

    // Avoid collision with Firebase's own auto-collected event names.
    const REMAP: Record<string, string> = {
      first_open:    'pf_first_open',
      session_start: 'pf_session_start',
      session_end:   'pf_session_end',
    };

    Analytics.sink = (evt: any) => {
      const name = safeName(REMAP[String(evt.event || '')] ?? evt.event ?? 'unknown');
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(evt)) {
        if (SKIP.has(k) || v === null || v === undefined) continue;
        const pk = safeName(k);
        params[pk] = typeof v === 'number' ? v : String(v).slice(0, 100);
      }
      FA.logEvent({ name, params }).catch(() => {});
    };
  })();
