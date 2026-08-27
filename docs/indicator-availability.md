# Indicator availability across GNOME Shell 40–50

Which panel indicator fields exist on which GNOME Shell version, and which of
them this extension can hide. Every cell below was read directly from the
GNOME Shell release source, because a wrong version claim once shipped a
version gate that hid a working toggle from every user on GNOME 45–49.

## Method

`js/ui/panel.js` was read in full at tags 40.0, 41.0, 42.0, 43.0, 44.0, 45.0,
47.0, 49.0 and 50.0, listing every `this._<name> =` assignment in the
indicator setup method in source order. 46.0 and 48.0 were spot-checked
field-by-field rather than fully re-listed; re-read them directly before
relying on a 46 or 48 cell for anything load-bearing. The volume split was
confirmed separately from `js/ui/status/volume.js`: 43.0 and 44.0 export one
combined `Indicator`, while 45.0+ export `OutputIndicator` and
`InputIndicator`.

## Two structural breaks

**GNOME 43 replaced the Aggregate Menu with Quick Settings.** On 40–42 the
container is `Main.panel.statusArea.aggregateMenu`; from 43 on it is
`Main.panel.statusArea.quickSettings`. This is not a rename — the field set
differs, and `_power` disappears as a separate indicator because power folds
into `_system`.

**GNOME 45 split the volume indicator.** Through 44, `_volume` is a single
indicator that holds both the speaker icon and the microphone icon as internal
children (`_primaryIndicator` and `_inputIndicator`). From 45 on these are two
top-level fields, `_volumeOutput` and `_volumeInput`. Hiding the microphone
independently before 45 therefore means reaching inside `_volume`, which is
what the legacy tree does.

## Availability matrix

`agg` = Aggregate Menu (40–42), `qs` = Quick Settings (43+).

| Field | Container | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `_network` † | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_bluetooth` † | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_system` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_brightness` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_remoteAccess` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_location` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_nightLight` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_thunderbolt` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_rfkill` | agg → qs | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_power` | agg only | ● | ● | ● | — | — | — | — | — | — | — | — |
| `_volume` (combined) | agg → qs | ● | ● | ● | ● | ● | — | — | — | — | — | — |
| `_powerProfiles` | agg → qs | — | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_unsafeMode` | agg → qs | — | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `_darkMode` | qs | — | — | — | ● | ● | ● | ● | ● | ● | ● | ● |
| `_autoRotate` | qs | — | — | — | ● | ● | ● | ● | ● | ● | ● | ● |
| `_backgroundApps` | qs | — | — | — | — | ● | ● | ● | ● | ● | ● | ● |
| `_volumeOutput` | qs | — | — | — | — | — | ● | ● | ● | ● | ● | ● |
| `_volumeInput` | qs | — | — | — | — | — | ● | ● | ● | ● | ● | ● |
| `_camera` | qs | — | — | — | — | — | ● | ● | ● | ● | ● | ● |
| `_backlight` | qs | — | — | — | — | — | ● | ● | ● | ● | ● | ● |
| `_doNotDisturb` | qs | — | — | — | — | — | — | — | — | — | ● | ● |

● present · — absent

† `_network` and `_bluetooth` are the only two fields that are conditionally
constructed. `_setupIndicators()` assigns `null` to them when
`Config.HAVE_NETWORKMANAGER` / `Config.HAVE_BLUETOOTH` are false at build
time, so the field **exists as a property with value `null`** rather than
being absent. Everything else in the table is constructed unconditionally.

Field counts: 11 at 40.0, 13 at 41.0–42.0, 14 at 43.0, 15 at 44.0, 18 at
45.0–48.0, 19 at 49.0–50.0.

## Why the conditional fields matter to this extension

- **Readiness.** `indicators.ts` marks only `volume` and `power` as
  `required`, and `PanelBinding.isReady()` waits only on those — requiring
  `network` or `bluetooth` would make readiness unsatisfiable on a shell built
  without NetworkManager or without Bluetooth.
- **The self-check.** `GnomeShellPort.selfCheck()` tests
  `!(row.qsField in panel)`, not a null check, so a present-but-null
  `_bluetooth` on a machine with no adapter stays silent while a renamed or
  misspelled field warns.

## What this extension currently hides

Two independent trees ship from this repository: the modern one
(`indicators.ts` + `prefs.ts`, GNOME 45–50) and the legacy one
(`legacy/extension.js` + `legacy/prefs.js`, GNOME 40–44). They share the
GSettings schema and nothing else.

### Coverage at a glance

Every indicator that exists is covered in the tree that can reach it, except
`_unsafeMode`. "Field absent" marks a range where the indicator does not exist
at all, so there is nothing there to hide.

| Field | Modern tree (45–50) | Legacy tree (40–44) |
|---|---|---|
| `_volumeOutput` | ✅ `hide-volume` | field absent before 45 |
| `_volumeInput` | ✅ `hide-microphone` | field absent before 45 |
| `_volume` (combined) | field absent from 45 | ✅ `hide-volume` |
| `_system` | ✅ `hide-power` | ✅ `hide-power` (43–44) |
| `_power` | field absent from 43 | ✅ `hide-power` (40–42) |
| `_network` † | ✅ `hide-network` | ✅ `hide-network` |
| `_bluetooth` † | ✅ `hide-bluetooth` | ✅ `hide-bluetooth` |
| `_camera` | ✅ `hide-camera` | field absent before 45 |
| `_backlight` | ✅ `hide-backlight` | field absent before 45 |
| `_doNotDisturb` | ✅ `hide-do-not-disturb` | field absent before 49 |
| `_location` | ✅ `hide-location` | ✅ `hide-location` |
| `_remoteAccess` | ✅ `hide-remote-access` | ✅ `hide-remote-access` |
| `_rfkill` | ✅ `hide-rfkill` | ✅ `hide-rfkill` |
| `_thunderbolt` | ✅ `hide-thunderbolt` | ✅ `hide-thunderbolt` |
| `_brightness` | ✅ `hide-brightness` | ✅ `hide-brightness` |
| `_nightLight` | ✅ `hide-night-light` | ✅ `hide-night-light` |
| `_powerProfiles` | ✅ `hide-power-profiles` | ✅ `hide-power-profiles` (41–44) |
| `_darkMode` | ✅ `hide-dark-mode` | ✅ `hide-dark-mode` (43–44) |
| `_autoRotate` | ✅ `hide-auto-rotate` | ✅ `hide-auto-rotate` (43–44) |
| `_backgroundApps` | ✅ `hide-background-apps` | ✅ `hide-background-apps` (44 only) |
| `_unsafeMode` | 🚫 excluded by design | 🚫 excluded by design |

`_unsafeMode` is excluded on purpose, in both trees. It is GNOME's own "unsafe
mode is on" warning, and the point of that icon is to be seen; shipping a
switch to suppress it would be shipping a switch to hide a security notice.

### Modern tree — the catalog

One row per `INDICATORS` entry in `indicators.ts`, in catalog order, which is
also the order the switches appear in the preferences window. Group order comes
from the `GROUPS` array.

| Group | kind | GSettings key | Field | `since` | `required` |
|---|---|---|---|:-:|:-:|
| Sound | `volume` | `hide-volume` | `_volumeOutput` | 45 | yes |
| Sound | `microphone` | `hide-microphone` | `_volumeInput` | 45 | — |
| Privacy | `camera` | `hide-camera` | `_camera` | 45 | — |
| Privacy | `location` | `hide-location` | `_location` | 45 | — |
| Privacy | `remoteAccess` | `hide-remote-access` | `_remoteAccess` | 45 | — |
| Connectivity | `network` | `hide-network` | `_network` | 45 | — |
| Connectivity | `bluetooth` | `hide-bluetooth` | `_bluetooth` | 45 | — |
| Connectivity | `rfkill` | `hide-rfkill` | `_rfkill` | 45 | — |
| Connectivity | `thunderbolt` | `hide-thunderbolt` | `_thunderbolt` | 45 | — |
| Display | `brightness` | `hide-brightness` | `_brightness` | 45 | — |
| Display | `backlight` | `hide-backlight` | `_backlight` | 45 | — |
| Display | `nightLight` | `hide-night-light` | `_nightLight` | 45 | — |
| Display | `darkMode` | `hide-dark-mode` | `_darkMode` | 45 | — |
| Display | `autoRotate` | `hide-auto-rotate` | `_autoRotate` | 45 | — |
| Power | `power` | `hide-power` | `_system` | 45 | yes |
| Power | `powerProfiles` | `hide-power-profiles` | `_powerProfiles` | 45 | — |
| Status | `doNotDisturb` | `hide-do-not-disturb` | `_doNotDisturb` | **49** | — |
| Status | `backgroundApps` | `hide-background-apps` | `_backgroundApps` | 45 | — |

`since` drives the `row.since > shellVersion` gate in `prefs.ts`: the Do Not
Disturb row is the only one hidden anywhere, and only on 45–48. `required` is
what `PanelBinding.isReady()` waits for — see the section above for why only
these two qualify.

### Legacy tree — field resolution

`legacy/extension.js` carries a single `INDICATOR_ROWS` table, one row per
kind, with `agg` and `qs` naming the field on each container — `null` when
the indicator does not exist there at all. A field may also be a dotted path
(`_volume._inputIndicator`) to reach one level inside a container; the
resolver walks each segment and treats a missing or falsy step as "not
present here".

| kind | GSettings key | 40–42, Aggregate Menu | 43–44, Quick Settings | prefs `since` |
|---|---|---|---|:-:|
| `microphone` | `hide-microphone` | `_volume._inputIndicator` | `_volume._inputIndicator` | 40 |
| `volume` | `hide-volume` | `_volume` | `_volume` | 40 |
| `bluetooth` | `hide-bluetooth` | `_bluetooth` | `_bluetooth` | 40 |
| `network` | `hide-network` | `_network` | `_network` | 40 |
| `power` | `hide-power` | `_power` | `_system` | 40 |
| `brightness` | `hide-brightness` | `_brightness` | `_brightness` | 40 |
| `location` | `hide-location` | `_location` | `_location` | 40 |
| `nightLight` | `hide-night-light` | `_nightLight` | `_nightLight` | 40 |
| `remoteAccess` | `hide-remote-access` | `_remoteAccess` | `_remoteAccess` | 40 |
| `rfkill` | `hide-rfkill` | `_rfkill` | `_rfkill` | 40 |
| `thunderbolt` | `hide-thunderbolt` | `_thunderbolt` | `_thunderbolt` | 40 |
| `powerProfiles` | `hide-power-profiles` | `_powerProfiles` (41–42; absent at 40) | `_powerProfiles` | 41 |
| `darkMode` | `hide-dark-mode` | — | `_darkMode` | 43 |
| `autoRotate` | `hide-auto-rotate` | — | `_autoRotate` | 43 |
| `backgroundApps` | `hide-background-apps` | — | `_backgroundApps` (44 only) | 44 |

All fifteen rows resolve to a live indicator somewhere in 40–44. Microphone is
the only one that reaches its icon one level deeper, inside the combined
`_volume` indicator, rather than as a direct field of the container.

`legacy/extension.js` and `legacy/prefs.js` depend on the global `imports`
machinery the old extension loader provides, and cannot be imported under
plain Node. None of the legacy tree is covered by the test suite, and none of
it can be.

## Container rebuild signals

The panel's indicator container (`_indicators`, an `StBoxLayout`) is watched for
rebuilds. **The signal names differ by Shell version**, read by
`GObject.signal_lookup()` on a running shell rather than assumed:

| Shell | `child-added` / `child-removed` | `actor-added` / `actor-removed` |
|---|:-:|:-:|
| 44 | absent | present (id 75/76) |
| 45 | absent | present (id 91/92) |
| 50 | present | present |

43 was not measured; it shares GNOME 44's Quick Settings container and is
assumed to match. The 46–49 crossover point was never pinned down and does not
need to be: `attachRebuildWatch()` in both trees tries `child-added` first and
falls back to `actor-added`, so the boundary is irrelevant.

Assuming `child-added` existed everywhere is what broke hiding outright on
GNOME 43–45. The connect threw, the exception escaped before the code that
applies the hide state ever ran, and the extension silently did nothing at all.
That is why the watch is now best-effort in both trees: it exists only to
re-apply hiding after a rebuild, so it must never be able to prevent the
initial hide. Verified on real VMs — before the fix GNOME 44 and 45 hid nothing
with the flags set; after it, they hide correctly.

## Quick Settings fields on GNOME 44 (measured)

Probed on a real Shell 44.0 session. Every `qs` field the legacy table expects
resolves, and the two 45-only fields are correctly absent:

`_volume` `_network` `_system` `_bluetooth` `_darkMode` `_autoRotate`
`_backgroundApps` `_powerProfiles` `_location` `_remoteAccess` `_rfkill`
`_thunderbolt` `_brightness` `_nightLight` — all present.
`_volumeInput` / `_volumeOutput` — absent, as the table says (45+).
