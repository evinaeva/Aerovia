// ===== 12b-native-play-games — нативный мост Google Play Games (Capacitor) =====
// One fragment of the single game IIFE (01 opens, 13 closes) — shared script scope, not ES modules.
// Provides: window.PFPlayGames (нативные системные экраны) на Android-сборке.
// Reads: 07 (Account, Leaderboard); 12 (ACH). На вебе/PWA — no-op (mock-провайдеры остаются).
// Свопает Account.authProvider + Leaderboard.provider на нативные и зеркалит разблокировку
// медалей (ACH.setMirror) в Play Games. ID — из Play Console (docs/play-games-setup.md).
// Плагин: @openforge/capacitor-game-connect (window.Capacitor.Plugins.CapacitorGameConnect).

  (() => {
    // Медаль в игре → достижение Play Games. steps>0 = инкрементальное достижение
    // (при разблокировке медали закрываем его одним incrementAchievementProgress на полное
    // число шагов). Первая партия — 5 медалей; остальные добавятся по мере заведения в Console.
    const PG_ACH: Record<string, { id: string; steps: number }> = {
      land1:    { id: 'CgkI962yq8MPEAIQAw', steps: 0 },
      svc1:     { id: 'CgkI962yq8MPEAIQBA', steps: 0 },
      takeoff1: { id: 'CgkI962yq8MPEAIQBQ', steps: 0 },
      level1:   { id: 'CgkI962yq8MPEAIQAQ', steps: 0 },
      land10:   { id: 'CgkI962yq8MPEAIQAg', steps: 10 },
    };
    const PG_LB_SURVIVAL = 'CgkI962yq8MPEAIQAA';

    const cap: any = (window as any).Capacitor;
    const isNative = () => { try { return !!(cap && cap.isNativePlatform && cap.isNativePlatform()); } catch(e){ return false; } };
    if (!isNative()) return;                         // веб/PWA — оставляем mock-провайдеры из 07
    const PG: any = cap.Plugins && cap.Plugins.CapacitorGameConnect;
    if (!PG) return;

    // НЕ зовём signIn() при старте: авто-вход заставляет Play Games глушить окно согласия
    // ("sign-in timing strategy suppressed"), и игрок не успевает дать согласие на drive.appdata
    // (Saved Games). Вход — только по жесту игрока (кнопка на экране рейтинга → Account.signIn()
    // → authProvider ниже), либо при submitRun() после захода Survival.

    // 1) Идентичность: Account.authProvider → нативный вход Play Games.
    Account.authProvider = ((): Promise<any> => Promise.resolve(PG.signIn()).then((r: any) => ({
      id: (r && r.player_id) || 'play-games', name: (r && r.player_name) || null, provider: 'play-games',
    }))) as any;

    // 2) Рейтинг: submit → submitScore. Нативно список топов не отдаётся (есть системный
    //    оверлей showLeaderboard), поэтому top() пустой — экран-трофей заменяется нативным UI.
    Leaderboard.provider = {
      submit(entry: any){
        const score = Math.max(0, Math.round((entry && entry.score) || 0));
        return Promise.resolve(PG.submitScore({ leaderboardID: PG_LB_SURVIVAL, totalScoreAmount: score }))
          .then(() => true).catch(() => false);
      },
      top(){ return Promise.resolve([]); },
    } as any;

    // 3) Медали: зеркалим разблокировку в Play Games (standard → unlock, incremental → progress).
    ACH.setMirror((id: string) => {
      const m = PG_ACH[id]; if (!m) return;          // вне первой партии — пока пропускаем
      try {
        if (m.steps > 0) PG.incrementAchievementProgress({ achievementID: m.id, pointsToIncrement: m.steps });
        else PG.unlockAchievement({ achievementID: m.id });
      } catch(e){}
    });

    // 4) Хуки для UI: нативные системные экраны Play Games (можно повесить на кнопки меню).
    (window as any).PFPlayGames = {
      showLeaderboard(){ try { PG.showLeaderboard({ leaderboardID: PG_LB_SURVIVAL }); } catch(e){} },
      showAchievements(){ try { PG.showAchievements(); } catch(e){} },
      signIn(){ return Promise.resolve(PG.signIn()); },
    };
  })();
