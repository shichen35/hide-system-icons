# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A GNOME Shell extension that hides selected indicators (volume, mic, camera, network, power, etc.) from the Quick Settings panel, via per-indicator GSettings toggles. Ships as **two independent packages** built from one repo:

- **Modern** (`*.ts` at repo root → `dist/`): GNOME Shell 45–50, ESM, TypeScript.
- **Legacy** (`legacy/*.js` → `legacy-dist/`): GNOME Shell 40–44, the old `imports`-based extension loader, plain JS (cannot be TypeScript or ESM — the legacy loader doesn't support either).

The two trees share the GSettings schema (`schemas/org.gnome.shell.extensions.hide-system-icons.gschema.xml`) and nothing else — no shared source, no shared build step. Changes to indicator behavior generally need to be made in both places.

## Commands

```bash
npm install                 # install dependencies (@girs/gjs, @girs/gnome-shell type defs)
npm test                    # compile test-relevant modules + fakes, run node's test runner
make pack                   # build both modern and legacy zips
make pack-modern            # build dist/ + hide-system-icons-gnome-45-50.zip only
make pack-legacy            # build legacy-dist/ + hide-system-icons-gnome-40-44.zip only
make install-modern         # pack-modern, then install to ~/.local/share/gnome-shell/extensions
make install-legacy         # pack-legacy, then install to ~/.local/share/gnome-shell/extensions
make clean                  # remove dist/, legacy-dist/, node_modules/, zips
```

`npm test` runs `tsc -p tsconfig.test.json && node --test 'dist-test/test/*.test.js'`. To run a single test file after compiling once:

```bash
node --test dist-test/test/hidePolicy.test.js
```

To filter by test name (after compiling):

```bash
node --test --test-name-pattern="idlePending guard" 'dist-test/test/*.test.js'
```

`tsconfig.test.json` only includes the platform-free modules (`hiddenIndicator.ts`, `panelBinding.ts`, `hidePolicy.ts`, `indicators.ts`) plus `test/**/*.ts` — it deliberately excludes `extension.ts`, `gnomeShellPort.ts`, and `prefs.ts`, which touch real GNOME/GJS APIs and aren't unit-testable outside a running Shell. The legacy tree (plain `imports`-global JS) also isn't and can't be covered by this suite.

## Architecture (modern tree)

Layered so the core hide/restore logic never touches a real GNOME API directly — everything platform-specific is isolated behind one interface, which is what makes `hidePolicy.ts` unit-testable with fakes (`test/fakes/`).

```
extension.ts          → enable()/disable() entry point, owns a HidePolicy
  gnomeShellPort.ts    → GnomeShellPort implements ShellPort: the only file that
                          touches Main.panel, GLib.idle_add, Gio.Settings, dashToPanel
  hidePolicy.ts        → HidePolicy: platform-free orchestration (idle-retry loop,
                          settings/panel-change watching, PanelBinding lifecycle)
  panelBinding.ts       → PanelBinding: per-QuickSettingsPanel state — resolves each
                          indicator field, applies hide/restore, watches for rebuilds
  hiddenIndicator.ts    → HiddenIndicator: wraps a single indicator; re-asserts hide
                          if the indicator re-shows itself (notify::visible)
  indicators.ts         → INDICATORS: the single declarative catalog (kind, GSettings
                          key, QS field name, GNOME version introduced, required?)
prefs.ts               → preferences UI, built by iterating GROUPS/INDICATORS
```

`indicators.ts` is the source of truth for the modern tree: both `panelBinding.ts` (what to hide) and `prefs.ts` (what toggle to show, gated by `since` vs. the running Shell version) iterate the same `INDICATORS` array. Adding a new indicator to the modern tree means adding one row here, not editing multiple places.

**Readiness / idle-retry loop.** On enable, `HidePolicy` polls via `port.idle()` until required panel fields exist (capped at 50 ticks), then does the first sync and starts watching for panel rebuilds. Only `volume` and `power` are marked `required: true` in `INDICATORS` — see `docs/indicator-availability.md` for why (network/bluetooth can be legitimately `null` on hardware/build configs that lack them, so requiring them would make readiness unsatisfiable on some systems). Don't add more `required: true` rows without re-reading that doc.

**Rebuild watching.** Quick Settings rebuilds its indicator container on things like lock/unlock; `PanelBinding` watches `child-added`/`child-removed` on `_indicators`/`_grid` and re-applies hide state when it fires.

**Multi-monitor.** `GnomeShellPort.panels()` also collects per-monitor Quick Settings panels from Dash to Panel (`global.dashToPanel.panels`) when present, and `watchPanels()` reacts to Dash to Panel's `panels-created` signal.

## Architecture (legacy tree)

`legacy/extension.js` is self-contained and mirrors the modern tree's behavior (idle-retry readiness, per-panel state, rebuild watch, Dash to Panel multi-monitor) with its own `INDICATOR_ROWS` table instead of importing `indicators.ts` — the old loader can't consume ESM/TypeScript. It resolves indicators against `agg` (Aggregate Menu, GNOME 40–42) or `qs` (Quick Settings, GNOME 43–44) fields per row, since GNOME 43 replaced the Aggregate Menu with Quick Settings. It's explicitly in maintenance mode: new indicators need a manual, parallel addition here after being added to `indicators.ts`.

## Before adding or changing an indicator

Read `docs/indicator-availability.md` first. It's a field-by-field matrix of which QS/Aggregate Menu fields exist on which GNOME Shell version (40–50), read directly from GNOME Shell release source rather than assumed — it exists because a wrong `since` value on the power-profiles indicator once hid a working toggle from every user on GNOME 45–49. It also documents the two structural breaks that make version handling non-obvious: GNOME 43's Aggregate Menu → Quick Settings switch, and GNOME 45's `_volume` split into `_volumeOutput`/`_volumeInput`. Before 45, the legacy tree reaches the microphone icon one level deeper, at `_volume._inputIndicator` — the resolver in `legacy/extension.js` supports dotted field paths for exactly this.

## Commit messages

Single-line Conventional Commits only (`type(scope): summary`, no body) — e.g. `feat(legacy): hide ten more indicators on GNOME 40-44, gated by version`, `fix: power profiles is supported since GNOME 45, not 50`. Match the type/scope style already in `git log`.
