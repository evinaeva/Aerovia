// Cross-module contracts for the shared IIFE scope.
//
// The game is one big IIFE split across src/game/01..13. A module written in
// TypeScript still needs to know about names DEFINED in the other (still
// JavaScript) modules it calls into. Declare those here so the type-checker can
// see them. As each owning module is converted to .ts, move its real
// declaration there and delete it from this file — this file should shrink to
// nothing once the migration is done.

/** Persisted player data. Owned by 06-state-layout / 11-menu-ui (load/saveGame).
 *  Only the fields consumed by already-typed modules are spelled out; the index
 *  signature keeps the rest accessible until those modules are typed too. */
interface SaveData {
  lang: string | null;
  [key: string]: unknown;
}
declare let save: SaveData;

/** Persist `save` to localStorage. Owned by 11-menu-ui. */
declare function saveGame(): void;

/** Analytics shim (no-op until a backend exists). Owned by the services module. */
declare const Analytics: { track(event: string, props?: Record<string, unknown>): void };

/** Rebuild the pause-screen info panel after a language switch. Owned by 11-menu-ui. */
declare function buildPauseInfo(): void;
