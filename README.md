# Hide System Icons (GNOME Extension)

Hide specific system icons from the GNOME Quick Settings panel.

![Screenshot](screenshots/screenshot.png)

## Install

Install from GNOME Extensions: [Hide System Icons](https://extensions.gnome.org/extension/8558/hide-system-icons/)

## Compatibility

- GNOME Shell 45–49

## Features

- Hide network icon
- Hide volume icon
- Hide power icon
- Hide Bluetooth icon
- Changes apply immediately and persist across restarts

## Settings

Preferences: Extensions app → this extension → Preferences. Available toggles:
- Hide volume icon
- Hide network icon
- Hide power icon
- Hide Bluetooth icon

GSettings (advanced):
- Schema: `org.gnome.shell.extensions.hide-system-icons`
- Keys:
  - `hide-volume` (boolean)
  - `hide-network` (boolean)
  - `hide-power` (boolean)
  - `hide-bluetooth` (boolean)

## Manual installation (from source)

Prerequisites:
- make, zip, glib-compile-schemas
- Node.js and npm

```bash
npm install
make pack
make install
```

## License

MIT — see `LICENSE`.