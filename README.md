# Hide System Icons (GNOME Extension)

Hide specific system icons from the GNOME Quick Settings panel.

- Compatible with GNOME Shell 45–49
- UUID: `hide-system-icons@shichen35.github.io`
- Install path: `~/.local/share/gnome-shell/extensions/hide-system-icons@shichen35.github.io`

## Features

- Hide network icon
- Hide volume icon
- Hide power icon
- Changes apply immediately and persist across restarts

## Settings

- GSettings schema: `org.gnome.shell.extensions.hide-system-icons`
- Keys:
  - `hide-volume` (boolean)
  - `hide-network` (boolean)
  - `hide-power` (boolean)

A Preferences window is provided (Extensions app → this extension → Preferences) with three toggles:
- Hide volume icon
- Hide network icon
- Hide power icon

## Installation (from source)

Prereqs: make, zip, glib-compile-schemas, Node.js + npm

```bash
npm install
make pack
make install