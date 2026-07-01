// ===== 12f-back-button — Android hardware/gesture back button (Capacitor @capacitor/app) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: — (registers a native backButton listener; no exports).
// Reads: 06 (running, paused), 11 (setPaused + every screen's own .m-back button — reused via .click()
// so this module never re-implements per-screen navigation logic, just picks which one applies).

  // Registering this listener replaces Capacitor's default Android behavior (exit the activity)
  // for the WHOLE app — without it, "back" mid-level or mid-menu just kills the app instead of
  // navigating, which is exactly the gap docs/play-featuring-plan.md flags. Screen → its own
  // back/cancel/close button, topmost overlay first (dialogs that stack over another screen —
  // askReset's #confirmScreen over settings, #againConfirmScreen over the results screen — come
  // before the screen they stack over).
  const BACK_BUTTON_MAP: [string, string][] = [
    ['goalsScreen', 'goalsOk'],
    ['restartConfirmScreen', 'restartCancelBtn'],
    ['confirmScreen', 'resetCancelBtn'],
    ['againConfirmScreen', 'againCancelBtn'],
    ['debugScreen', 'debugBackBtn'],
    ['pauseScreen', 'resumeBtn'],
    ['settingsScreen', 'settingsBackBtn'],
    ['biomeScreen', 'biomesBackBtn'],
    ['levelScreen', 'backBtn'],
    ['medalScreen', 'medalsBackBtn'],
    ['leaderboardScreen', 'leaderboardBackBtn'],
    ['overScreen', 'toLevelsBtn'],
  ];

  function handleHardwareBack(){
    for(const [screenId, backBtnId] of BACK_BUTTON_MAP){
      const screen=document.getElementById(screenId);
      if(screen && !screen.classList.contains('hidden')){
        document.getElementById(backBtnId)?.click();
        return;
      }
    }
    if(running && !paused){ setPaused(true); return; }   // mid-level, no overlay open → pause instead of exiting
    const cap: any=(window as any).Capacitor;
    if(cap && cap.Plugins && cap.Plugins.App) cap.Plugins.App.exitApp();  // top-level menu → real exit
  }

  { const cap: any=(window as any).Capacitor;
    if(cap && cap.Plugins && cap.Plugins.App) cap.Plugins.App.addListener('backButton', handleHardwareBack); }
