// Cross-module contracts for the shared IIFE scope.
//
// The game is ONE IIFE split across src/game/01..13 (shared global *script*
// scope — not ES modules). 01-bootstrap-theme.js opens the IIFE and 13-init.js
// closes it; neither parses standalone, so they stay .js and are not type-
// checked. A .ts module that references a name DEFINED in those .js files needs
// it declared here. Names defined in .ts modules resolve directly through the
// shared scope and must NOT be redeclared here.

// --- from 01-bootstrap-theme.js (canvas handle + palette / theme bootstrap) ---
declare const cv: HTMLCanvasElement;
declare const ctx: CanvasRenderingContext2D;
declare const PALETTE: Record<string, string>;
declare const NEON_TOKENS: Record<string, string>;
declare const THEME: { tokens: Record<string, string> };
declare let ATLAS: boolean;

// Optional hook: refreshes the game-over leaderboard panel if that module wired it
// up (called behind a typeof === 'function' guard). Owned by 11-menu-ui.
declare const refreshOverLeaderboard: ((res: any) => void) | undefined;

// --- from 11b-editor.ts (editor→game handoff flag) ---
// Set true when a game session was launched from the level editor (changes pause/over
// screen routing: "back to editor" instead of main menu / next level).
