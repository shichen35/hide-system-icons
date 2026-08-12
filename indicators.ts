export type IndicatorKind = 'microphone' | 'volume' | 'bluetooth' | 'network' | 'power' | 'powerProfiles';

export type QSField = '_volumeInput' | '_volumeOutput' | '_bluetooth' | '_network' | '_powerProfiles' | '_system';

export interface IndicatorRow {
  kind: IndicatorKind;
  settingKey: string;
  qsField: QSField;
  title: string;
  subtitle: string;
  since: number;
  required: boolean;
}

export const INDICATORS: readonly IndicatorRow[] = [
  {
    kind: 'microphone',
    settingKey: 'hide-microphone',
    qsField: '_volumeInput',
    title: 'Hide microphone',
    subtitle: 'Hide the microphone indicator.',
    since: 45,
    required: false,
  },
  {
    kind: 'volume',
    settingKey: 'hide-volume',
    qsField: '_volumeOutput',
    title: 'Hide volume',
    subtitle: 'Hide the volume indicator.',
    since: 45,
    required: true,
  },
  {
    kind: 'bluetooth',
    settingKey: 'hide-bluetooth',
    qsField: '_bluetooth',
    title: 'Hide Bluetooth',
    subtitle: 'Hide the Bluetooth indicator.',
    since: 45,
    required: false,
  },
  {
    kind: 'network',
    settingKey: 'hide-network',
    qsField: '_network',
    title: 'Hide network',
    subtitle: 'Hide the network indicator.',
    since: 45,
    required: false,
  },
  {
    kind: 'powerProfiles',
    settingKey: 'hide-power-profiles',
    qsField: '_powerProfiles',
    title: 'Hide power profiles',
    subtitle: 'Hide the power profiles indicator.',
    since: 50,
    required: false,
  },
  {
    kind: 'power',
    settingKey: 'hide-power',
    qsField: '_system',
    title: 'Hide power',
    subtitle: 'Hide the power indicator.',
    since: 45,
    required: true,
  },
];
