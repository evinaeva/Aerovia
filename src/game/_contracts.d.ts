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

declare const HANDOFF_IMG: {
  bg:         HTMLImageElement | null;
  apron:      HTMLImageElement | null;
  vpp:        HTMLImageElement | null;
  vppConn:    HTMLImageElement | null;
  hangar:     HTMLImageElement | null;
  gate:       HTMLImageElement | null;
  hud:        HTMLImageElement | null;
  plane:      HTMLImageElement | null;
  planes:     (HTMLImageElement | HTMLCanvasElement)[];
  ready:      boolean;
  hangarBase: HTMLImageElement | null;
  svcFuel:    HTMLImageElement | null;
  svcRepair:  HTMLImageElement | null;
  svcBoard:   HTMLImageElement | null;
};
declare function _hiOk(im: HTMLImageElement | HTMLCanvasElement | null): boolean;
declare function _hiDraw(im: HTMLImageElement | HTMLCanvasElement | null, cx: number, cy: number, w: number, h: number, rotDeg?: number): boolean;
