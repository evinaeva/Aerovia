// ===== 12g-in-app-review — Google Play In-App Review (нативный промпт оценки) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: requestReviewIfDue() — зовётся из 10-scene-loop.endLevel() на победе на уровне.
// Нативный плагин: window.Capacitor.Plugins.InAppReview (см. scripts/setup-android.mjs →
// InAppReviewPlugin.java, Google Play Core Review API). На вебе/PWA — no-op: у Google нет
// системного промпта вне обёртки Play Store.
//
// docs/play-featuring-plan.md, User Experience: показывать системный промпт в удачный момент
// (после победы на уровне), не кастомный диалог. Google квотирует, сколько раз промпт реально
// покажется игроку, но клиентская сторона всё равно не должна дёргать API на каждой победе —
// ждём REVIEW_MIN_WINS побед (не первый уровень) и держим свой кулдаун поверх гугловской квоты.

  const REVIEW_KEY = 'planeflow_review_v1';    // {wins, asked} — свой троттлинг поверх квоты Google
  const REVIEW_MIN_WINS = 3;
  const REVIEW_COOLDOWN_MS = 30*24*60*60*1000; // не чаще раза в 30 дней

  function readReviewState(): { wins: number; asked: number } {
    try {
      const s = JSON.parse(localStorage.getItem(REVIEW_KEY) || 'null');
      return (s && typeof s.wins === 'number') ? s : { wins: 0, asked: 0 };
    } catch (e) { return { wins: 0, asked: 0 }; }
  }
  function writeReviewState(s: { wins: number; asked: number }) {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function requestReviewIfDue(){
    const s = readReviewState();
    s.wins++;
    if(s.wins < REVIEW_MIN_WINS || Date.now()-s.asked < REVIEW_COOLDOWN_MS){ writeReviewState(s); return; }
    const cap: any = (window as any).Capacitor;
    if(!cap || !cap.isNativePlatform || !cap.isNativePlatform()){ writeReviewState(s); return; } // веб/PWA — нет системного промпта
    const RV: any = cap.Plugins && cap.Plugins.InAppReview;
    if(!RV){ writeReviewState(s); return; }    // плагин не собран в этой сборке — тихо выходим
    s.asked = Date.now(); writeReviewState(s);
    Promise.resolve(RV.requestReview()).catch(() => {}); // сам вызов ничего не гарантирует — квота Google решает, покажется ли промпт
  }
