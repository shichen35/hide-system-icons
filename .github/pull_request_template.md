<!--
Title: a single-line Conventional Commit, e.g. `feat: hide the foo indicator`
or `fix(legacy): restore mic icon after unlock`. Commits follow the same rule
(no body). See CONTRIBUTING.md.
-->

## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one (Fixes #123). -->

## Which package does this affect?

- [ ] Modern (GNOME 45–51, `*.ts`)
- [ ] Legacy (GNOME 40–44, `legacy/`)
- [ ] Both
- [ ] Neither (build, CI, docs)

<!-- Indicator behavior usually needs the same change in both trees. If you only changed one, say why. -->

## Adding or changing an indicator

<!-- Delete this section if it doesn't apply. -->

- [ ] I checked `docs/indicator-availability.md` for the field and the GNOME versions it exists on, and updated it if anything changed.
- [ ] Modern: one row in `indicators.ts` with the correct `since` (and `required` left `false`, unless the doc says otherwise).
- [ ] Legacy: matching rows in `INDICATOR_ROWS` in both `legacy/extension.js` and `legacy/prefs.js`, or an explanation of why it doesn't apply to 40–44.
- [ ] New GSettings key added to `schemas/org.gnome.shell.extensions.hide-system-icons.gschema.xml`.
- [ ] If the indicator warns the user that something is happening (camera, microphone, location, screen sharing), it's marked `privacySensitive` with a warning.

## Testing

- [ ] `npm test` passes.
- [ ] `make pack` builds both zips.
- [ ] Tested on a real GNOME Shell session:

| GNOME Shell version | Distro / session (Wayland or X11) | Result |
|---|---|---|
|  |  |  |

<!-- What you toggled, and whether you also checked lock/unlock and disabling then re-enabling the extension. -->

## Changelog

- [ ] Added an entry under `## [Unreleased]` in `CHANGELOG.md`, or this change isn't user-visible.

## Screenshots

<!-- For changes to the preferences window or the panel, before and after. -->
