export type IndicatorKind =
  | 'microphone'
  | 'volume'
  | 'bluetooth'
  | 'network'
  | 'power'
  | 'powerProfiles'
  | 'camera'
  | 'location'
  | 'remoteAccess'
  | 'rfkill'
  | 'thunderbolt'
  | 'brightness'
  | 'backlight'
  | 'nightLight'
  | 'darkMode'
  | 'autoRotate'
  | 'doNotDisturb'
  | 'backgroundApps';

export type QSField =
  | '_volumeInput'
  | '_volumeOutput'
  | '_bluetooth'
  | '_network'
  | '_powerProfiles'
  | '_system'
  | '_camera'
  | '_location'
  | '_remoteAccess'
  | '_rfkill'
  | '_thunderbolt'
  | '_brightness'
  | '_backlight'
  | '_nightLight'
  | '_darkMode'
  | '_autoRotate'
  | '_doNotDisturb'
  | '_backgroundApps';

export type QSGroup = 'hardware' | 'appearance' | 'privacy';

export interface IndicatorRow {
  group: QSGroup;
  kind: IndicatorKind;
  settingKey: string;
  qsField: QSField;
  title: string;
  subtitle: string;
  since: number;
  required: boolean;
  privacySensitive?: boolean;
  privacyWarning?: string;
}

const N_ = (s: string): string => s;

export const GROUPS: readonly { id: QSGroup; title: string }[] = [
  { id: 'hardware', title: N_('Hardware') },
  { id: 'appearance', title: N_('Display & Appearance') },
  { id: 'privacy', title: N_('Privacy & System') },
];

export const INDICATORS: readonly IndicatorRow[] = [
  {
    group: 'hardware',
    kind: 'volume',
    settingKey: 'hide-volume',
    qsField: '_volumeOutput',
    title: N_('Hide volume'),
    subtitle: N_('Hide the volume indicator.'),
    since: 45,
    required: true,
  },
  {
    group: 'hardware',
    kind: 'microphone',
    settingKey: 'hide-microphone',
    qsField: '_volumeInput',
    title: N_('Hide microphone'),
    subtitle: N_('Hide the microphone indicator.'),
    since: 45,
    required: false,
    privacySensitive: true,
    privacyWarning: N_(
      'The microphone indicator is your only on-screen sign that an app is recording. ' +
        'If you hide it, recording can start with no visible warning.',
    ),
  },
  {
    group: 'hardware',
    kind: 'network',
    settingKey: 'hide-network',
    qsField: '_network',
    title: N_('Hide network'),
    subtitle: N_('Hide the network indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'hardware',
    kind: 'bluetooth',
    settingKey: 'hide-bluetooth',
    qsField: '_bluetooth',
    title: N_('Hide Bluetooth'),
    subtitle: N_('Hide the Bluetooth indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'hardware',
    kind: 'rfkill',
    settingKey: 'hide-rfkill',
    qsField: '_rfkill',
    title: N_('Hide airplane mode'),
    subtitle: N_('Hide the airplane mode indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'hardware',
    kind: 'thunderbolt',
    settingKey: 'hide-thunderbolt',
    qsField: '_thunderbolt',
    title: N_('Hide Thunderbolt'),
    subtitle: N_('Hide the Thunderbolt indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'appearance',
    kind: 'brightness',
    settingKey: 'hide-brightness',
    qsField: '_brightness',
    title: N_('Hide brightness'),
    subtitle: N_('Hide the brightness indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'appearance',
    kind: 'backlight',
    settingKey: 'hide-backlight',
    qsField: '_backlight',
    title: N_('Hide keyboard backlight'),
    subtitle: N_('Hide the keyboard backlight indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'appearance',
    kind: 'nightLight',
    settingKey: 'hide-night-light',
    qsField: '_nightLight',
    title: N_('Hide night light'),
    subtitle: N_('Hide the night light indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'appearance',
    kind: 'darkMode',
    settingKey: 'hide-dark-mode',
    qsField: '_darkMode',
    title: N_('Hide dark mode'),
    subtitle: N_('Hide the dark mode indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'appearance',
    kind: 'autoRotate',
    settingKey: 'hide-auto-rotate',
    qsField: '_autoRotate',
    title: N_('Hide auto rotate'),
    subtitle: N_('Hide the auto rotate indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'privacy',
    kind: 'camera',
    settingKey: 'hide-camera',
    qsField: '_camera',
    title: N_('Hide camera'),
    subtitle: N_('Hide the camera indicator.'),
    since: 45,
    required: false,
    privacySensitive: true,
    privacyWarning: N_(
      'The camera indicator is your only on-screen sign that an app is using your camera. ' +
        'If you hide it, the camera can turn on with no visible warning.',
    ),
  },
  {
    group: 'privacy',
    kind: 'location',
    settingKey: 'hide-location',
    qsField: '_location',
    title: N_('Hide location'),
    subtitle: N_('Hide the location indicator.'),
    since: 45,
    required: false,
    privacySensitive: true,
    privacyWarning: N_(
      'The location indicator is your only on-screen sign that an app is reading your location. ' +
        'If you hide it, your location can be accessed with no visible warning.',
    ),
  },
  {
    group: 'privacy',
    kind: 'remoteAccess',
    settingKey: 'hide-remote-access',
    qsField: '_remoteAccess',
    title: N_('Hide screen sharing'),
    subtitle: N_('Hide the screen sharing indicator.'),
    since: 45,
    required: false,
    privacySensitive: true,
    privacyWarning: N_(
      'The screen sharing indicator is your only on-screen sign that your screen is being shared or recorded. ' +
        'If you hide it, sharing can continue with no visible warning.',
    ),
  },
  {
    group: 'privacy',
    kind: 'power',
    settingKey: 'hide-power',
    qsField: '_system',
    title: N_('Hide power'),
    subtitle: N_('Hide the power indicator.'),
    since: 45,
    required: true,
  },
  {
    group: 'privacy',
    kind: 'powerProfiles',
    settingKey: 'hide-power-profiles',
    qsField: '_powerProfiles',
    title: N_('Hide power profiles'),
    subtitle: N_('Hide the power profiles indicator.'),
    since: 45,
    required: false,
  },
  {
    group: 'privacy',
    kind: 'doNotDisturb',
    settingKey: 'hide-do-not-disturb',
    qsField: '_doNotDisturb',
    title: N_('Hide Do Not Disturb'),
    subtitle: N_('Hide the Do Not Disturb indicator.'),
    since: 49,
    required: false,
  },
  {
    group: 'privacy',
    kind: 'backgroundApps',
    settingKey: 'hide-background-apps',
    qsField: '_backgroundApps',
    title: N_('Hide background apps'),
    subtitle: N_('Hide the background apps indicator.'),
    since: 45,
    required: false,
  },
];

export const availableIndicators = (shellVersion: number): readonly IndicatorRow[] =>
  INDICATORS.filter(row => !(row.since > shellVersion));
