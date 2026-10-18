# Contributing

Thanks for helping out. Bug reports, icon requests and pull requests are all welcome. For anything bigger than a small fix, please open an issue first so we can agree on the approach before you write code.

## Setup

You need Node.js 22.22.2 or newer (24 recommended), npm, make, zip and `glib-compile-schemas`.

```bash
npm install
npm test          # unit tests
make pack         # builds both zips
```

## How the project is laid out

One repository builds two independent packages:

| Package | Source | GNOME Shell | Notes |
|---|---|---|---|
| Modern | `*.ts` at the root | 45–51 | ESM, TypeScript |
| Legacy | `legacy/*.js` | 40–44 | Plain JS for the old `imports` loader. Maintenance mode. |

They share only the GSettings schema in `schemas/`. A change to how indicators behave usually has to be made in both. [CLAUDE.md](CLAUDE.md) describes the architecture of each tree in detail.

## Testing your change

### Unit tests

`npm test` covers the platform-free modules of the modern tree (`hidePolicy.ts`, `panelBinding.ts`, `hiddenIndicator.ts`, `indicators.ts`) using fakes in `test/fakes/`. Add or update tests there when you change those files. `extension.ts`, `gnomeShellPort.ts`, `prefs.ts` and the legacy tree need a running GNOME Shell, so they can only be tested by hand.

### In GNOME Shell

Install your build, then test in a nested session so a mistake can't take down your desktop:

```bash
make install-modern     # or make install-legacy on GNOME 40–44

# GNOME 49 and newer
dbus-run-session gnome-shell --devkit --wayland

# GNOME 45–48
dbus-run-session -- gnome-shell --nested --wayland
```

Inside the nested session, open a terminal and run:

```bash
gnome-extensions enable hide-system-icons@shichen35.github.io
gnome-extensions prefs hide-system-icons@shichen35.github.io
```

Watch the logs while you test:

```bash
journalctl -f -o cat /usr/bin/gnome-shell   # the extension
journalctl -f -o cat /usr/bin/gjs           # the preferences window
```

Besides the setting you changed, please check:

- **Lock and unlock.** Quick Settings rebuilds its icons on unlock, and hidden icons must stay hidden.
- **Disable and re-enable the extension.** Every icon must come back when the extension is disabled.
- **Dash to Panel**, if your change touches how panels are found. It adds a Quick Settings menu per monitor.

For the legacy package you need GNOME 40–44, which in practice means a virtual machine, for example Ubuntu 22.04 (GNOME 42) or Fedora 38 (GNOME 44).

Say in your pull request which GNOME versions you tested on. Nobody can test all of them, so the reviewer needs to know which ones were actually run.

## Adding a hideable icon

1. Read [docs/indicator-availability.md](docs/indicator-availability.md). It records which Quick Settings field exists on which GNOME version, read from the GNOME Shell source. Getting this wrong has shipped bugs before. Update it if you find anything new.
2. Add a boolean key to `schemas/org.gnome.shell.extensions.hide-system-icons.gschema.xml`.
3. **Modern:** add one row to `INDICATORS` in `indicators.ts`. Set `since` to the first GNOME version that has the field. Leave `required` as `false`; the doc explains why. The preferences window builds itself from this list.
4. **Legacy:** if the field exists on GNOME 40–44, add a matching row to the `INDICATOR_ROWS` tables in both `legacy/extension.js` and `legacy/prefs.js`.
5. If the icon is how GNOME tells the user something is happening (camera, microphone, location, screen sharing), mark it `privacySensitive` with a `privacyWarning`, so users confirm before hiding it.

Icons that exist to warn the user, such as the "unsafe mode" indicator, are deliberately not hideable.

## Commits and pull requests

- **Commit messages** are single-line [Conventional Commits](https://www.conventionalcommits.org/) with no body, for example `feat: hide the foo indicator` or `fix(legacy): keep the microphone hidden after unlock`. Use the same format for the pull request title.
- **Changelog:** add user-visible changes under `## [Unreleased]` in `CHANGELOG.md`.
- **CI** runs the tests and builds both zips on every pull request, and must pass.
- The pull request template has a checklist. Fill in the parts that apply and delete the rest.

## Releases

Maintainers cut releases with `npm version` and a tag push; see [Releasing](README.md#releasing) in the README. Contributors don't need to bump versions.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
